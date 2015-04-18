var window = window || {};
var isNativeScriptApplication = ((typeof android !== "undefined" && android && android.widget && android.widget.Button) || (typeof UIButton !== "undefined" && UIButton));
/*!
 * Reqwest! A general purpose XHR connection manager
 * (c) Dustin Diaz 2013
 * https://github.com/ded/reqwest
 * license MIT
 */
;
! function (a, c, b) {
    if (typeof module != "undefined" && module.exports) {
        module.exports = b()
    } else {
        if (typeof define == "function" && define.amd) {
            define(b)
        } else {
            c[a] = b()
        }
    }
}("reqwest", this, function () {
    if (typeof (isNativeScriptApplication) !== "undefined" && isNativeScriptApplication) {
        return
    }
    var win = window,
        doc = document,
        twoHundo = /^20\d$/,
        byTag = "getElementsByTagName",
        readyState = "readyState",
        contentType = "Content-Type",
        requestedWith = "X-Requested-With",
        head = doc[byTag]("head")[0],
        uniqid = 0,
        callbackPrefix = "reqwest_" + (+new Date()),
        lastValue, xmlHttpRequest = "XMLHttpRequest",
        noop = function () {},
        isArray = typeof Array.isArray == "function" ? Array.isArray : function (a) {
            return a instanceof Array
        },
        defaultHeaders = {
            contentType: "application/x-www-form-urlencoded",
            requestedWith: xmlHttpRequest,
            accept: {
                "*": "text/javascript, text/html, application/xml, text/xml, */*",
                xml: "application/xml, text/xml",
                html: "text/html",
                text: "text/plain",
                json: "application/json, text/javascript",
                js: "application/javascript, text/javascript"
            }
        },
        xhr = win[xmlHttpRequest] ? function () {
            return new XMLHttpRequest()
        } : function () {
            return new ActiveXObject("Microsoft.XMLHTTP")
        },
        globalSetupOptions = {
            dataFilter: function (data) {
                return data
            }
        };

    function handleReadyState(r, success, error) {
        return function () {
            if (r._aborted) {
                return error(r.request)
            }
            if (r.request && r.request[readyState] == 4) {
                r.request.onreadystatechange = noop;
                if (twoHundo.test(r.request.status)) {
                    success(r.request)
                } else {
                    error(r.request)
                }
            }
        }
    }

    function setHeaders(http, o) {
        var headers = o.headers || {},
            h;
        headers.Accept = headers.Accept || defaultHeaders.accept[o.type] || defaultHeaders.accept["*"];
        if (!o.crossOrigin && !headers[requestedWith]) {
            headers[requestedWith] = defaultHeaders.requestedWith
        }
        if (!headers[contentType]) {
            headers[contentType] = o.contentType || defaultHeaders.contentType
        }
        for (h in headers) {
            headers.hasOwnProperty(h) && http.setRequestHeader(h, headers[h])
        }
    }

    function setCredentials(http, o) {
        if (typeof o.withCredentials !== "undefined" && typeof http.withCredentials !== "undefined") {
            http.withCredentials = !!o.withCredentials
        }
    }

    function generalCallback(data) {
        lastValue = data
    }

    function urlappend(url, s) {
        return url + (/\?/.test(url) ? "&" : "?") + s
    }

    function handleJsonp(o, fn, err, url) {
        var reqId = uniqid++,
            cbkey = o.jsonpCallback || "callback",
            cbval = o.jsonpCallbackName || reqwest.getcallbackPrefix(reqId),
            cbreg = new RegExp("((^|\\?|&)" + cbkey + ")=([^&]+)"),
            match = url.match(cbreg),
            script = doc.createElement("script"),
            loaded = 0,
            isIE10 = navigator.userAgent.indexOf("MSIE 10.0") !== -1;
        if (match) {
            if (match[3] === "?") {
                url = url.replace(cbreg, "$1=" + cbval)
            } else {
                cbval = match[3]
            }
        } else {
            url = urlappend(url, cbkey + "=" + cbval)
        }
        win[cbval] = generalCallback;
        script.type = "text/javascript";
        script.src = url;
        script.async = true;
        if (typeof script.onreadystatechange !== "undefined" && !isIE10) {
            script.event = "onclick";
            script.htmlFor = script.id = "_reqwest_" + reqId
        }
        script.onload = script.onreadystatechange = function () {
            if ((script[readyState] && script[readyState] !== "complete" && script[readyState] !== "loaded") || loaded) {
                return false
            }
            script.onload = script.onreadystatechange = null;
            script.onclick && script.onclick();
            o.success && o.success(lastValue);
            lastValue = undefined;
            head.removeChild(script);
            loaded = 1
        };
        head.appendChild(script);
        return {
            abort: function () {
                script.onload = script.onreadystatechange = null;
                o.error && o.error({}, "Request is aborted: timeout", {});
                lastValue = undefined;
                head.removeChild(script);
                loaded = 1
            }
        }
    }

    function getRequest(fn, err) {
        var o = this.o,
            method = (o.method || "GET").toUpperCase(),
            url = typeof o === "string" ? o : o.url,
            data = (o.processData !== false && o.data && typeof o.data !== "string") ? reqwest.toQueryString(o.data) : (o.data || null),
            http;
        if ((o.type == "jsonp" || method == "GET") && data) {
            url = urlappend(url, data);
            data = null
        }
        if (o.type == "jsonp") {
            return handleJsonp(o, fn, err, url)
        }
        http = xhr();
        http.open(method, url, true);
        setHeaders(http, o);
        setCredentials(http, o);
        http.onreadystatechange = handleReadyState(this, fn, err);
        o.before && o.before(http);
        http.send(data);
        return http
    }

    function Reqwest(o, fn) {
        this.o = o;
        this.fn = fn;
        init.apply(this, arguments)
    }

    function setType(url) {
        var m = url.match(/\.(json|jsonp|html|xml)(\?|$)/);
        return m ? m[1] : "js"
    }

    function init(o, fn) {
        this.url = typeof o == "string" ? o : o.url;
        this.timeout = null;
        this._fulfilled = false;
        this._fulfillmentHandlers = [];
        this._errorHandlers = [];
        this._completeHandlers = [];
        this._erred = false;
        this._responseArgs = {};
        var self = this,
            type = o.type || setType(this.url);
        fn = fn || function () {};
        if (o.timeout) {
            this.timeout = setTimeout(function () {
                self.abort()
            }, o.timeout)
        }
        if (o.success) {
            this._fulfillmentHandlers.push(function () {
                o.success.apply(o, arguments)
            })
        }
        if (o.error) {
            this._errorHandlers.push(function () {
                o.error.apply(o, arguments)
            })
        }
        if (o.complete) {
            this._completeHandlers.push(function () {
                o.complete.apply(o, arguments)
            })
        }

        function complete(resp) {
            o.timeout && clearTimeout(self.timeout);
            self.timeout = null;
            while (self._completeHandlers.length > 0) {
                self._completeHandlers.shift()(resp)
            }
        }

        function success(resp) {
            var filteredResponse = globalSetupOptions.dataFilter(resp.responseText, type),
                r = resp.responseText = filteredResponse;
            if (r) {
                switch (type) {
                    case "json":
                        try {
                            resp = win.JSON ? win.JSON.parse(r) : eval("(" + r + ")")
                        } catch (err) {
                            return error(resp, "Could not parse JSON in response", err)
                        }
                        break;
                    case "js":
                        resp = eval(r);
                        break;
                    case "html":
                        resp = r;
                        break;
                    case "xml":
                        resp = resp.responseXML && resp.responseXML.parseError && resp.responseXML.parseError.errorCode && resp.responseXML.parseError.reason ? null : resp.responseXML;
                        break
                }
            }
            self._responseArgs.resp = resp;
            self._fulfilled = true;
            fn(resp);
            while (self._fulfillmentHandlers.length > 0) {
                self._fulfillmentHandlers.shift()(resp)
            }
            complete(resp)
        }

        function error(resp, msg, t) {
            self._responseArgs.resp = resp;
            self._responseArgs.msg = msg;
            self._responseArgs.t = t;
            self._erred = true;
            while (self._errorHandlers.length > 0) {
                self._errorHandlers.shift()(resp, msg, t)
            }
            complete(resp)
        }
        this.request = getRequest.call(this, success, error)
    }
    Reqwest.prototype = {
        abort: function () {
            this._aborted = true;
            this.request.abort()
        },
        retry: function () {
            init.call(this, this.o, this.fn)
        },
        then: function (success, fail) {
            if (this._fulfilled) {
                success(this._responseArgs.resp)
            } else {
                if (this._erred) {
                    fail(this._responseArgs.resp, this._responseArgs.msg, this._responseArgs.t)
                } else {
                    this._fulfillmentHandlers.push(success);
                    this._errorHandlers.push(fail)
                }
            }
            return this
        },
        always: function (fn) {
            if (this._fulfilled || this._erred) {
                fn(this._responseArgs.resp)
            } else {
                this._completeHandlers.push(fn)
            }
            return this
        },
        fail: function (fn) {
            if (this._erred) {
                fn(this._responseArgs.resp, this._responseArgs.msg, this._responseArgs.t)
            } else {
                this._errorHandlers.push(fn)
            }
            return this
        }
    };

    function reqwest(o, fn) {
        return new Reqwest(o, fn)
    }

    function normalize(s) {
        return s ? s.replace(/\r?\n/g, "\r\n") : ""
    }

    function serial(el, cb) {
        var n = el.name,
            t = el.tagName.toLowerCase(),
            optCb = function (o) {
                if (o && !o.disabled) {
                    cb(n, normalize(o.attributes.value && o.attributes.value.specified ? o.value : o.text))
                }
            },
            ch, ra, val, i;
        if (el.disabled || !n) {
            return
        }
        switch (t) {
            case "input":
                if (!/reset|button|image|file/i.test(el.type)) {
                    ch = /checkbox/i.test(el.type);
                    ra = /radio/i.test(el.type);
                    val = el.value;
                    (!(ch || ra) || el.checked) && cb(n, normalize(ch && val === "" ? "on" : val))
                }
                break;
            case "textarea":
                cb(n, normalize(el.value));
                break;
            case "select":
                if (el.type.toLowerCase() === "select-one") {
                    optCb(el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null)
                } else {
                    for (i = 0; el.length && i < el.length; i++) {
                        el.options[i].selected && optCb(el.options[i])
                    }
                }
                break
        }
    }

    function eachFormElement() {
        var cb = this,
            e, i, serializeSubtags = function (e, tags) {
                var i, j, fa;
                for (i = 0; i < tags.length; i++) {
                    fa = e[byTag](tags[i]);
                    for (j = 0; j < fa.length; j++) {
                        serial(fa[j], cb)
                    }
                }
            };
        for (i = 0; i < arguments.length; i++) {
            e = arguments[i];
            if (/input|select|textarea/i.test(e.tagName)) {
                serial(e, cb)
            }
            serializeSubtags(e, ["input", "select", "textarea"])
        }
    }

    function serializeQueryString() {
        return reqwest.toQueryString(reqwest.serializeArray.apply(null, arguments))
    }

    function serializeHash() {
        var hash = {};
        eachFormElement.apply(function (name, value) {
            if (name in hash) {
                hash[name] && !isArray(hash[name]) && (hash[name] = [hash[name]]);
                hash[name].push(value)
            } else {
                hash[name] = value
            }
        }, arguments);
        return hash
    }
    reqwest.serializeArray = function () {
        var arr = [];
        eachFormElement.apply(function (name, value) {
            arr.push({
                name: name,
                value: value
            })
        }, arguments);
        return arr
    };
    reqwest.serialize = function () {
        if (arguments.length === 0) {
            return ""
        }
        var opt, fn, args = Array.prototype.slice.call(arguments, 0);
        opt = args.pop();
        opt && opt.nodeType && args.push(opt) && (opt = null);
        opt && (opt = opt.type);
        if (opt == "map") {
            fn = serializeHash
        } else {
            if (opt == "array") {
                fn = reqwest.serializeArray
            } else {
                fn = serializeQueryString
            }
        }
        return fn.apply(null, args)
    };
    reqwest.toQueryString = function (o) {
        var qs = "",
            i, enc = encodeURIComponent,
            push = function (k, v) {
                qs += enc(k) + "=" + enc(v) + "&"
            },
            k, v;
        if (isArray(o)) {
            for (i = 0; o && i < o.length; i++) {
                push(o[i].name, o[i].value)
            }
        } else {
            for (k in o) {
                if (!Object.hasOwnProperty.call(o, k)) {
                    continue
                }
                v = o[k];
                if (isArray(v)) {
                    for (i = 0; i < v.length; i++) {
                        push(k, v[i])
                    }
                } else {
                    push(k, o[k])
                }
            }
        }
        return qs.replace(/&$/, "").replace(/%20/g, "+")
    };
    reqwest.getcallbackPrefix = function () {
        return callbackPrefix
    };
    reqwest.compat = function (o, fn) {
        if (o) {
            o.type && (o.method = o.type) && delete o.type;
            o.dataType && (o.type = o.dataType);
            o.jsonpCallback && (o.jsonpCallbackName = o.jsonpCallback) && delete o.jsonpCallback;
            o.jsonp && (o.jsonpCallback = o.jsonp)
        }
        return new Reqwest(o, fn)
    };
    reqwest.ajaxSetup = function (options) {
        options = options || {};
        for (var k in options) {
            globalSetupOptions[k] = options[k]
        }
    };
    return reqwest
});
/*! RSVP.js provides simple tools for organizing asynchronous code.
 * https://github.com/tildeio/rsvp.js
 * Copyright (c) 2013 Yehuda Katz, Tom Dale, and contributors
 */
(function () {
    if (typeof (isNativeScriptApplication) !== "undefined" && isNativeScriptApplication) {
        return
    }
    var b, a;
    (function () {
        var d = {},
            c = {};
        b = function (e, f, g) {
            d[e] = {
                deps: f,
                callback: g
            }
        };
        a = function (e) {
            if (c[e]) {
                return c[e]
            }
            c[e] = {};
            var k = d[e],
                o = k.deps,
                n = k.callback,
                h = [],
                g;
            for (var j = 0, f = o.length; j < f; j++) {
                if (o[j] === "exports") {
                    h.push(g = {})
                } else {
                    h.push(a(o[j]))
                }
            }
            var m = n.apply(this, h);
            return c[e] = g || m
        }
    })();
    b("rsvp/all", ["rsvp/defer", "exports"], function (f, d) {
        var e = f.defer;

        function c(m) {
            var l = [],
                j = e(),
                n = m.length;
            if (n === 0) {
                j.resolve([])
            }
            var o = function (i) {
                return function (p) {
                    g(i, p)
                }
            };
            var g = function (i, p) {
                l[i] = p;
                if (--n === 0) {
                    j.resolve(l)
                }
            };
            var h = function (i) {
                j.reject(i)
            };
            for (var k = 0; k < m.length; k++) {
                if (m[k] && typeof m[k].then === "function") {
                    m[k].then(o(k), h)
                } else {
                    g(k, m[k])
                }
            }
            return j.promise
        }
        d.all = c
    });
    b("rsvp/async", ["exports"], function (h) {
        var d = (typeof window !== "undefined") ? window : {};
        var i = d.MutationObserver || d.WebKitMutationObserver;
        var g;
        if (typeof process !== "undefined" && {}.toString.call(process) === "[object process]") {
            g = function (k, j) {
                process.nextTick(function () {
                    k.call(j)
                })
            }
        } else {
            if (i) {
                var c = [];
                var e = new i(function () {
                    var j = c.slice();
                    c = [];
                    j.forEach(function (k) {
                        var m = k[0],
                            l = k[1];
                        m.call(l)
                    })
                });
                var f = document.createElement("div");
                e.observe(f, {
                    attributes: true
                });
                window.addEventListener("unload", function () {
                    e.disconnect();
                    e = null
                });
                g = function (k, j) {
                    c.push([k, j]);
                    f.setAttribute("drainQueue", "drainQueue")
                }
            } else {
                g = function (k, j) {
                    setTimeout(function () {
                        k.call(j)
                    }, 1)
                }
            }
        }
        h.async = g
    });
    b("rsvp/config", ["rsvp/async", "exports"], function (f, e) {
        var d = f.async;
        var c = {};
        c.async = d;
        e.config = c
    });
    b("rsvp/defer", ["rsvp/promise", "exports"], function (f, d) {
        var c = f.Promise;

        function e() {
            var g = {};
            var h = new c(function (j, i) {
                g.resolve = j;
                g.reject = i
            });
            g.promise = h;
            return g
        }
        d.defer = e
    });
    b("rsvp/events", ["exports"], function (f) {
        var c = function (j, h) {
            this.type = j;
            for (var i in h) {
                if (!h.hasOwnProperty(i)) {
                    continue
                }
                this[i] = h[i]
            }
        };
        var d = function (k, m) {
            for (var j = 0, h = k.length; j < h; j++) {
                if (k[j][0] === m) {
                    return j
                }
            }
            return -1
        };
        var e = function (h) {
            var i = h._promiseCallbacks;
            if (!i) {
                i = h._promiseCallbacks = {}
            }
            return i
        };
        var g = {
            mixin: function (h) {
                h.on = this.on;
                h.off = this.off;
                h.trigger = this.trigger;
                return h
            },
            on: function (m, l, k) {
                var j = e(this),
                    i, h;
                m = m.split(/\s+/);
                k = k || this;
                while (h = m.shift()) {
                    i = j[h];
                    if (!i) {
                        i = j[h] = []
                    }
                    if (d(i, l) === -1) {
                        i.push([l, k])
                    }
                }
            },
            off: function (m, l) {
                var k = e(this),
                    j, h, i;
                m = m.split(/\s+/);
                while (h = m.shift()) {
                    if (!l) {
                        k[h] = [];
                        continue
                    }
                    j = k[h];
                    i = d(j, l);
                    if (i !== -1) {
                        j.splice(i, 1)
                    }
                }
            },
            trigger: function (k, q) {
                var o = e(this),
                    l, n, p, m, h;
                if (l = o[k]) {
                    for (var j = 0; j < l.length; j++) {
                        n = l[j];
                        p = n[0];
                        m = n[1];
                        if (typeof q !== "object") {
                            q = {
                                detail: q
                            }
                        }
                        h = new c(k, q);
                        p.call(m, h)
                    }
                }
            }
        };
        f.EventTarget = g
    });
    b("rsvp/hash", ["rsvp/defer", "exports"], function (g, d) {
        var f = g.defer;

        function c(h) {
            var i = 0;
            for (var j in h) {
                i++
            }
            return i
        }

        function e(l) {
            var k = {},
                j = f(),
                m = c(l);
            if (m === 0) {
                j.resolve({})
            }
            var n = function (p) {
                return function (q) {
                    h(p, q)
                }
            };
            var h = function (q, p) {
                k[q] = p;
                if (--m === 0) {
                    j.resolve(k)
                }
            };
            var i = function (p) {
                j.reject(p)
            };
            for (var o in l) {
                if (l[o] && typeof l[o].then === "function") {
                    l[o].then(n(o), i)
                } else {
                    h(o, l[o])
                }
            }
            return j.promise
        }
        d.hash = e
    });
    b("rsvp/node", ["rsvp/promise", "rsvp/all", "exports"], function (h, d, g) {
        var f = h.Promise;
        var c = d.all;

        function e(k, j) {
            return function (l, m) {
                if (l) {
                    j(l)
                } else {
                    if (arguments.length > 2) {
                        k(Array.prototype.slice.call(arguments, 1))
                    } else {
                        k(m)
                    }
                }
            }
        }

        function i(j) {
            return function () {
                var n = Array.prototype.slice.call(arguments),
                    l, k;
                var m = new f(function (o, p) {
                    l = o;
                    k = p
                });
                c(n).then(function (p) {
                    p.push(e(l, k));
                    try {
                        j.apply(this, p)
                    } catch (o) {
                        k(o)
                    }
                });
                return m
            }
        }
        g.denodeify = i
    });
    b("rsvp/promise", ["rsvp/config", "rsvp/events", "exports"], function (i, l, k) {
        var f = i.config;
        var n = l.EventTarget;

        function c(o) {
            return d(o) || (typeof o === "object" && o !== null)
        }

        function d(o) {
            return typeof o === "function"
        }
        var g = function (s) {
            var r = this,
                o = false;
            if (typeof s !== "function") {
                throw new TypeError("You must pass a resolver function as the sole argument to the promise constructor")
            }
            if (!(r instanceof g)) {
                return new g(s)
            }
            var p = function (t) {
                if (o) {
                    return
                }
                o = true;
                j(r, t)
            };
            var q = function (t) {
                if (o) {
                    return
                }
                o = true;
                m(r, t)
            };
            this.on("promise:resolved", function (t) {
                this.trigger("success", {
                    detail: t.detail
                })
            }, this);
            this.on("promise:failed", function (t) {
                this.trigger("error", {
                    detail: t.detail
                })
            }, this);
            s(p, q)
        };
        var e = function (s, x, v, o) {
            var p = d(v),
                u, t, w, q;
            if (p) {
                try {
                    u = v(o.detail);
                    w = true
                } catch (r) {
                    q = true;
                    t = r
                }
            } else {
                u = o.detail;
                w = true
            }
            if (c(u) && d(u.then)) {
                u.then(function (y) {
                    j(x, y)
                }, function (y) {
                    m(x, y)
                })
            } else {
                if (p && w) {
                    j(x, u)
                } else {
                    if (q) {
                        m(x, t)
                    } else {
                        if (s === "resolve") {
                            j(x, u)
                        } else {
                            if (s === "reject") {
                                m(x, u)
                            }
                        }
                    }
                }
            }
        };
        g.prototype = {
            constructor: g,
            then: function (p, o) {
                var q = new g(function () {});
                if (this.isFulfilled) {
                    f.async(function () {
                        e("resolve", q, p, {
                            detail: this.fulfillmentValue
                        })
                    }, this)
                }
                if (this.isRejected) {
                    f.async(function () {
                        e("reject", q, o, {
                            detail: this.rejectedReason
                        })
                    }, this)
                }
                this.on("promise:resolved", function (r) {
                    e("resolve", q, p, r)
                });
                this.on("promise:failed", function (r) {
                    e("reject", q, o, r)
                });
                return q
            }
        };
        n.mixin(g.prototype);

        function j(p, o) {
            if (p === o) {
                h(p, o)
            } else {
                if (c(o) && d(o.then)) {
                    o.then(function (q) {
                        if (o !== q) {
                            j(p, q)
                        } else {
                            h(p, q)
                        }
                    }, function (q) {
                        m(p, q)
                    })
                } else {
                    h(p, o)
                }
            }
        }

        function h(p, o) {
            f.async(function () {
                p.trigger("promise:resolved", {
                    detail: o
                });
                p.isFulfilled = true;
                p.fulfillmentValue = o
            })
        }

        function m(p, o) {
            f.async(function () {
                p.trigger("promise:failed", {
                    detail: o
                });
                p.isRejected = true;
                p.rejectedReason = o
            })
        }
        k.Promise = g
    });
    b("rsvp/resolve", ["rsvp/promise", "exports"], function (g, f) {
        var e = g.Promise;

        function c(h) {
            return typeof h === "function" || (typeof h === "object" && h !== null)
        }

        function d(h) {
            var i = new e(function (l, k) {
                var m;
                try {
                    if (c(h)) {
                        m = h.then;
                        if (typeof m === "function") {
                            m.call(h, l, k)
                        } else {
                            l(h)
                        }
                    } else {
                        l(h)
                    }
                } catch (j) {
                    k(j)
                }
            });
            return i
        }
        f.resolve = d
    });
    b("rsvp", ["rsvp/events", "rsvp/promise", "rsvp/node", "rsvp/all", "rsvp/hash", "rsvp/defer", "rsvp/config", "rsvp/resolve", "exports"], function (n, c, o, j, p, k, r, m, h) {
        var l = n.EventTarget;
        var i = c.Promise;
        var d = o.denodeify;
        var f = j.all;
        var e = p.hash;
        var g = k.defer;
        var t = r.config;
        var q = m.resolve;

        function s(u, v) {
            t[u] = v
        }
        h.Promise = i;
        h.EventTarget = l;
        h.all = f;
        h.hash = e;
        h.defer = g;
        h.denodeify = d;
        h.configure = s;
        h.resolve = q
    });
    window.RSVP = a("rsvp")
})();
/*!
 * Underscore.js 1.4.4
 * http://underscorejs.org
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * Underscore may be freely distributed under the MIT license.
 */
(function () {
    var w = this;
    var k = w._;
    var D = {};
    var C = Array.prototype,
        f = Object.prototype,
        r = Function.prototype;
    var H = C.push,
        o = C.slice,
        y = C.concat,
        d = f.toString,
        j = f.hasOwnProperty;
    var L = C.forEach,
        q = C.map,
        E = C.reduce,
        c = C.reduceRight,
        b = C.filter,
        B = C.every,
        p = C.some,
        n = C.indexOf,
        l = C.lastIndexOf,
        u = Array.isArray,
        e = Object.keys,
        F = r.bind;
    var M = function (N) {
        if (N instanceof M) {
            return N
        }
        if (!(this instanceof M)) {
            return new M(N)
        }
        this._wrapped = N
    };
    if (typeof exports !== "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            exports = module.exports = M
        }
        exports._ = M
    } else {
        w._ = M
    }
    M.VERSION = "1.4.4";
    var I = M.each = M.forEach = function (S, R, Q) {
        if (S == null) {
            return
        }
        if (L && S.forEach === L) {
            S.forEach(R, Q)
        } else {
            if (S.length === +S.length) {
                for (var P = 0, N = S.length; P < N; P++) {
                    if (R.call(Q, S[P], P, S) === D) {
                        return
                    }
                }
            } else {
                for (var O in S) {
                    if (M.has(S, O)) {
                        if (R.call(Q, S[O], O, S) === D) {
                            return
                        }
                    }
                }
            }
        }
    };
    M.map = M.collect = function (Q, P, O) {
        var N = [];
        if (Q == null) {
            return N
        }
        if (q && Q.map === q) {
            return Q.map(P, O)
        }
        I(Q, function (T, R, S) {
            N.push(P.call(O, T, R, S))
        });
        return N
    };
    var g = "Reduce of empty array with no initial value";
    M.reduce = M.foldl = M.inject = function (R, Q, N, P) {
        var O = arguments.length > 2;
        if (R == null) {
            R = []
        }
        if (E && R.reduce === E) {
            if (P) {
                Q = M.bind(Q, P)
            }
            return O ? R.reduce(Q, N) : R.reduce(Q)
        }
        I(R, function (U, S, T) {
            if (!O) {
                N = U;
                O = true
            } else {
                N = Q.call(P, N, U, S, T)
            }
        });
        if (!O) {
            throw new TypeError(g)
        }
        return N
    };
    M.reduceRight = M.foldr = function (T, Q, N, P) {
        var O = arguments.length > 2;
        if (T == null) {
            T = []
        }
        if (c && T.reduceRight === c) {
            if (P) {
                Q = M.bind(Q, P)
            }
            return O ? T.reduceRight(Q, N) : T.reduceRight(Q)
        }
        var S = T.length;
        if (S !== +S) {
            var R = M.keys(T);
            S = R.length
        }
        I(T, function (W, U, V) {
            U = R ? R[--S] : --S;
            if (!O) {
                N = T[U];
                O = true
            } else {
                N = Q.call(P, N, T[U], U, V)
            }
        });
        if (!O) {
            throw new TypeError(g)
        }
        return N
    };
    M.find = M.detect = function (Q, P, O) {
        var N;
        A(Q, function (T, R, S) {
            if (P.call(O, T, R, S)) {
                N = T;
                return true
            }
        });
        return N
    };
    M.filter = M.select = function (Q, P, O) {
        var N = [];
        if (Q == null) {
            return N
        }
        if (b && Q.filter === b) {
            return Q.filter(P, O)
        }
        I(Q, function (T, R, S) {
            if (P.call(O, T, R, S)) {
                N.push(T)
            }
        });
        return N
    };
    M.reject = function (P, O, N) {
        return M.filter(P, function (S, Q, R) {
            return !O.call(N, S, Q, R)
        }, N)
    };
    M.every = M.all = function (Q, P, O) {
        P || (P = M.identity);
        var N = true;
        if (Q == null) {
            return N
        }
        if (B && Q.every === B) {
            return Q.every(P, O)
        }
        I(Q, function (T, R, S) {
            if (!(N = N && P.call(O, T, R, S))) {
                return D
            }
        });
        return !!N
    };
    var A = M.some = M.any = function (Q, P, O) {
        P || (P = M.identity);
        var N = false;
        if (Q == null) {
            return N
        }
        if (p && Q.some === p) {
            return Q.some(P, O)
        }
        I(Q, function (T, R, S) {
            if (N || (N = P.call(O, T, R, S))) {
                return D
            }
        });
        return !!N
    };
    M.contains = M.include = function (O, N) {
        if (O == null) {
            return false
        }
        if (n && O.indexOf === n) {
            return O.indexOf(N) != -1
        }
        return A(O, function (P) {
            return P === N
        })
    };
    M.invoke = function (P, Q) {
        var N = o.call(arguments, 2);
        var O = M.isFunction(Q);
        return M.map(P, function (R) {
            return (O ? Q : R[Q]).apply(R, N)
        })
    };
    M.pluck = function (O, N) {
        return M.map(O, function (P) {
            return P[N]
        })
    };
    M.where = function (O, N, P) {
        if (M.isEmpty(N)) {
            return P ? void 0 : []
        }
        return M[P ? "find" : "filter"](O, function (R) {
            for (var Q in N) {
                if (N[Q] !== R[Q]) {
                    return false
                }
            }
            return true
        })
    };
    M.findWhere = function (O, N) {
        return M.where(O, N, true)
    };
    M.max = function (Q, P, O) {
        if (!P && M.isArray(Q) && Q[0] === +Q[0] && Q.length < 65535) {
            return Math.max.apply(Math, Q)
        }
        if (!P && M.isEmpty(Q)) {
            return -Infinity
        }
        var N = {
            computed: -Infinity,
            value: -Infinity
        };
        I(Q, function (U, R, T) {
            var S = P ? P.call(O, U, R, T) : U;
            S >= N.computed && (N = {
                value: U,
                computed: S
            })
        });
        return N.value
    };
    M.min = function (Q, P, O) {
        if (!P && M.isArray(Q) && Q[0] === +Q[0] && Q.length < 65535) {
            return Math.min.apply(Math, Q)
        }
        if (!P && M.isEmpty(Q)) {
            return Infinity
        }
        var N = {
            computed: Infinity,
            value: Infinity
        };
        I(Q, function (U, R, T) {
            var S = P ? P.call(O, U, R, T) : U;
            S < N.computed && (N = {
                value: U,
                computed: S
            })
        });
        return N.value
    };
    M.shuffle = function (Q) {
        var P;
        var O = 0;
        var N = [];
        I(Q, function (R) {
            P = M.random(O++);
            N[O - 1] = N[P];
            N[P] = R
        });
        return N
    };
    var a = function (N) {
        return M.isFunction(N) ? N : function (O) {
            return O[N]
        }
    };
    M.sortBy = function (Q, P, N) {
        var O = a(P);
        return M.pluck(M.map(Q, function (T, R, S) {
            return {
                value: T,
                index: R,
                criteria: O.call(N, T, R, S)
            }
        }).sort(function (U, T) {
            var S = U.criteria;
            var R = T.criteria;
            if (S !== R) {
                if (S > R || S === void 0) {
                    return 1
                }
                if (S < R || R === void 0) {
                    return -1
                }
            }
            return U.index < T.index ? -1 : 1
        }), "value")
    };
    var t = function (S, R, O, Q) {
        var N = {};
        var P = a(R == null ? M.identity : R);
        I(S, function (V, T) {
            var U = P.call(O, V, T, S);
            Q(N, U, V)
        });
        return N
    };
    M.groupBy = function (P, O, N) {
        return t(P, O, N, function (Q, R, S) {
            (M.has(Q, R) ? Q[R] : (Q[R] = [])).push(S)
        })
    };
    M.countBy = function (P, O, N) {
        return t(P, O, N, function (Q, R) {
            if (!M.has(Q, R)) {
                Q[R] = 0
            }
            Q[R] ++
        })
    };
    M.sortedIndex = function (U, T, Q, P) {
        Q = Q == null ? M.identity : a(Q);
        var S = Q.call(P, T);
        var N = 0,
            R = U.length;
        while (N < R) {
            var O = (N + R) >>> 1;
            Q.call(P, U[O]) < S ? N = O + 1 : R = O
        }
        return N
    };
    M.toArray = function (N) {
        if (!N) {
            return []
        }
        if (M.isArray(N)) {
            return o.call(N)
        }
        if (N.length === +N.length) {
            return M.map(N, M.identity)
        }
        return M.values(N)
    };
    M.size = function (N) {
        if (N == null) {
            return 0
        }
        return (N.length === +N.length) ? N.length : M.keys(N).length
    };
    M.first = M.head = M.take = function (P, O, N) {
        if (P == null) {
            return void 0
        }
        return (O != null) && !N ? o.call(P, 0, O) : P[0]
    };
    M.initial = function (P, O, N) {
        return o.call(P, 0, P.length - ((O == null) || N ? 1 : O))
    };
    M.last = function (P, O, N) {
        if (P == null) {
            return void 0
        }
        if ((O != null) && !N) {
            return o.call(P, Math.max(P.length - O, 0))
        } else {
            return P[P.length - 1]
        }
    };
    M.rest = M.tail = M.drop = function (P, O, N) {
        return o.call(P, (O == null) || N ? 1 : O)
    };
    M.compact = function (N) {
        return M.filter(N, M.identity)
    };
    var x = function (O, P, N) {
        I(O, function (Q) {
            if (M.isArray(Q)) {
                P ? H.apply(N, Q) : x(Q, P, N)
            } else {
                N.push(Q)
            }
        });
        return N
    };
    M.flatten = function (O, N) {
        return x(O, N, [])
    };
    M.without = function (N) {
        return M.difference(N, o.call(arguments, 1))
    };
    M.uniq = M.unique = function (T, S, R, Q) {
        if (M.isFunction(S)) {
            Q = R;
            R = S;
            S = false
        }
        var O = R ? M.map(T, R, Q) : T;
        var P = [];
        var N = [];
        I(O, function (V, U) {
            if (S ? (!U || N[N.length - 1] !== V) : !M.contains(N, V)) {
                N.push(V);
                P.push(T[U])
            }
        });
        return P
    };
    M.union = function () {
        return M.uniq(y.apply(C, arguments))
    };
    M.intersection = function (O) {
        var N = o.call(arguments, 1);
        return M.filter(M.uniq(O), function (P) {
            return M.every(N, function (Q) {
                return M.indexOf(Q, P) >= 0
            })
        })
    };
    M.difference = function (O) {
        var N = y.apply(C, o.call(arguments, 1));
        return M.filter(O, function (P) {
            return !M.contains(N, P)
        })
    };
    M.zip = function () {
        var N = o.call(arguments);
        var Q = M.max(M.pluck(N, "length"));
        var P = new Array(Q);
        for (var O = 0; O < Q; O++) {
            P[O] = M.pluck(N, "" + O)
        }
        return P
    };
    M.unzip = function (O) {
        var N = M.max(M.pluck(O, "length"));
        return M.times(N, M.partial(M.pluck, O))
    };
    M.object = function (R, P) {
        if (R == null) {
            return {}
        }
        var N = {};
        for (var Q = 0, O = R.length; Q < O; Q++) {
            if (P) {
                N[R[Q]] = P[Q]
            } else {
                N[R[Q][0]] = R[Q][1]
            }
        }
        return N
    };
    M.indexOf = function (R, P, Q) {
        if (R == null) {
            return -1
        }
        var O = 0,
            N = R.length;
        if (Q) {
            if (typeof Q == "number") {
                O = (Q < 0 ? Math.max(0, N + Q) : Q)
            } else {
                O = M.sortedIndex(R, P);
                return R[O] === P ? O : -1
            }
        }
        if (n && R.indexOf === n) {
            return R.indexOf(P, Q)
        }
        for (; O < N; O++) {
            if (R[O] === P) {
                return O
            }
        }
        return -1
    };
    M.lastIndexOf = function (R, P, Q) {
        if (R == null) {
            return -1
        }
        var N = Q != null;
        if (l && R.lastIndexOf === l) {
            return N ? R.lastIndexOf(P, Q) : R.lastIndexOf(P)
        }
        var O = (N ? Q : R.length);
        while (O--) {
            if (R[O] === P) {
                return O
            }
        }
        return -1
    };
    M.range = function (S, Q, R) {
        if (arguments.length <= 1) {
            Q = S || 0;
            S = 0
        }
        R = arguments[2] || 1;
        var O = Math.max(Math.ceil((Q - S) / R), 0);
        var N = 0;
        var P = new Array(O);
        while (N < O) {
            P[N++] = S;
            S += R
        }
        return P
    };
    var G = function () {};
    M.bind = function (Q, O) {
        var N, P;
        if (Q.bind === F && F) {
            return F.apply(Q, o.call(arguments, 1))
        }
        if (!M.isFunction(Q)) {
            throw new TypeError
        }
        N = o.call(arguments, 2);
        return P = function () {
            if (!(this instanceof P)) {
                return Q.apply(O, N.concat(o.call(arguments)))
            }
            G.prototype = Q.prototype;
            var S = new G;
            G.prototype = null;
            var R = Q.apply(S, N.concat(o.call(arguments)));
            if (Object(R) === R) {
                return R
            }
            return S
        }
    };
    M.partial = function (O) {
        var N = o.call(arguments, 1);
        return function () {
            return O.apply(this, N.concat(o.call(arguments)))
        }
    };
    M.bindAll = function (O) {
        var N = o.call(arguments, 1);
        if (N.length === 0) {
            throw new Error("bindAll must be passed function names")
        }
        I(N, function (P) {
            O[P] = M.bind(O[P], O)
        });
        return O
    };
    M.memoize = function (P, O) {
        var N = {};
        O || (O = M.identity);
        return function () {
            var Q = O.apply(this, arguments);
            return M.has(N, Q) ? N[Q] : (N[Q] = P.apply(this, arguments))
        }
    };
    M.delay = function (O, P) {
        var N = o.call(arguments, 2);
        return setTimeout(function () {
            return O.apply(null, N)
        }, P)
    };
    M.defer = function (N) {
        return M.delay.apply(M, [N, 1].concat(o.call(arguments, 1)))
    };
    M.throttle = function (P, R, O) {
        var N, T, U, V;
        var S = 0;
        var Q = function () {
            S = new Date;
            U = null;
            V = P.apply(N, T)
        };
        return function () {
            var W = new Date;
            if (!S && O === false) {
                S = W
            }
            var X = R - (W - S);
            N = this;
            T = arguments;
            if (X <= 0) {
                clearTimeout(U);
                U = null;
                S = W;
                V = P.apply(N, T)
            } else {
                if (!U) {
                    U = setTimeout(Q, X)
                }
            }
            return V
        }
    };
    M.debounce = function (P, R, O) {
        var Q, N;
        return function () {
            var V = this,
                U = arguments;
            var T = function () {
                Q = null;
                if (!O) {
                    N = P.apply(V, U)
                }
            };
            var S = O && !Q;
            clearTimeout(Q);
            Q = setTimeout(T, R);
            if (S) {
                N = P.apply(V, U)
            }
            return N
        }
    };
    M.once = function (P) {
        var N = false,
            O;
        return function () {
            if (N) {
                return O
            }
            N = true;
            O = P.apply(this, arguments);
            P = null;
            return O
        }
    };
    M.wrap = function (N, O) {
        return function () {
            var P = [N];
            H.apply(P, arguments);
            return O.apply(this, P)
        }
    };
    M.compose = function () {
        var N = arguments;
        return function () {
            var O = arguments;
            for (var P = N.length - 1; P >= 0; P--) {
                O = [N[P].apply(this, O)]
            }
            return O[0]
        }
    };
    M.after = function (O, N) {
        if (O <= 0) {
            return N()
        }
        return function () {
            if (--O < 1) {
                return N.apply(this, arguments)
            }
        }
    };
    M.keys = e || function (P) {
        if (P !== Object(P)) {
            throw new TypeError("Invalid object")
        }
        var O = [];
        for (var N in P) {
            if (M.has(P, N)) {
                O.push(N)
            }
        }
        return O
    };
    M.values = function (P) {
        var N = [];
        for (var O in P) {
            if (M.has(P, O)) {
                N.push(P[O])
            }
        }
        return N
    };
    M.pairs = function (P) {
        var O = [];
        for (var N in P) {
            if (M.has(P, N)) {
                O.push([N, P[N]])
            }
        }
        return O
    };
    M.invert = function (P) {
        var N = {};
        for (var O in P) {
            if (M.has(P, O)) {
                N[P[O]] = O
            }
        }
        return N
    };
    M.functions = M.methods = function (P) {
        var O = [];
        for (var N in P) {
            if (M.isFunction(P[N])) {
                O.push(N)
            }
        }
        return O.sort()
    };
    M.extend = function (N) {
        I(o.call(arguments, 1), function (O) {
            if (O) {
                for (var P in O) {
                    N[P] = O[P]
                }
            }
        });
        return N
    };
    M.pick = function (O) {
        var P = {};
        var N = y.apply(C, o.call(arguments, 1));
        I(N, function (Q) {
            if (Q in O) {
                P[Q] = O[Q]
            }
        });
        return P
    };
    M.omit = function (P) {
        var Q = {};
        var O = y.apply(C, o.call(arguments, 1));
        for (var N in P) {
            if (!M.contains(O, N)) {
                Q[N] = P[N]
            }
        }
        return Q
    };
    M.defaults = function (N) {
        I(o.call(arguments, 1), function (O) {
            if (O) {
                for (var P in O) {
                    if (N[P] === void 0) {
                        N[P] = O[P]
                    }
                }
            }
        });
        return N
    };
    M.clone = function (N) {
        if (!M.isObject(N)) {
            return N
        }
        return M.isArray(N) ? N.slice() : M.extend({}, N)
    };
    M.tap = function (O, N) {
        N(O);
        return O
    };
    var J = function (U, T, O, P) {
        if (U === T) {
            return U !== 0 || 1 / U == 1 / T
        }
        if (U == null || T == null) {
            return U === T
        }
        if (U instanceof M) {
            U = U._wrapped
        }
        if (T instanceof M) {
            T = T._wrapped
        }
        var R = d.call(U);
        if (R != d.call(T)) {
            return false
        }
        switch (R) {
            case "[object String]":
                return U == String(T);
            case "[object Number]":
                return U != +U ? T != +T : (U == 0 ? 1 / U == 1 / T : U == +T);
            case "[object Date]":
            case "[object Boolean]":
                return +U == +T;
            case "[object RegExp]":
                return U.source == T.source && U.global == T.global && U.multiline == T.multiline && U.ignoreCase == T.ignoreCase
        }
        if (typeof U != "object" || typeof T != "object") {
            return false
        }
        var N = O.length;
        while (N--) {
            if (O[N] == U) {
                return P[N] == T
            }
        }
        O.push(U);
        P.push(T);
        var W = 0,
            X = true;
        if (R == "[object Array]") {
            W = U.length;
            X = W == T.length;
            if (X) {
                while (W--) {
                    if (!(X = J(U[W], T[W], O, P))) {
                        break
                    }
                }
            }
        } else {
            var S = U.constructor,
                Q = T.constructor;
            if (S !== Q && !(M.isFunction(S) && (S instanceof S) && M.isFunction(Q) && (Q instanceof Q))) {
                return false
            }
            for (var V in U) {
                if (M.has(U, V)) {
                    W++;
                    if (!(X = M.has(T, V) && J(U[V], T[V], O, P))) {
                        break
                    }
                }
            }
            if (X) {
                for (V in T) {
                    if (M.has(T, V) && !(W--)) {
                        break
                    }
                }
                X = !W
            }
        }
        O.pop();
        P.pop();
        return X
    };
    M.isEqual = function (O, N) {
        return J(O, N, [], [])
    };
    M.isEmpty = function (O) {
        if (O == null) {
            return true
        }
        if (M.isArray(O) || M.isString(O)) {
            return O.length === 0
        }
        for (var N in O) {
            if (M.has(O, N)) {
                return false
            }
        }
        return true
    };
    M.isElement = function (N) {
        return !!(N && N.nodeType === 1)
    };
    M.isArray = u || function (N) {
        return d.call(N) == "[object Array]"
    };
    M.isObject = function (N) {
        return N === Object(N)
    };
    I(["Arguments", "Function", "String", "Number", "Date", "RegExp"], function (N) {
        M["is" + N] = function (O) {
            return d.call(O) == "[object " + N + "]"
        }
    });
    if (!M.isArguments(arguments)) {
        M.isArguments = function (N) {
            return !!(N && M.has(N, "callee"))
        }
    }
    if (typeof (/./) !== "function") {
        M.isFunction = function (N) {
            return typeof N === "function"
        }
    }
    M.isFinite = function (N) {
        return isFinite(N) && !isNaN(parseFloat(N))
    };
    M.isNaN = function (N) {
        return M.isNumber(N) && N != +N
    };
    M.isBoolean = function (N) {
        return N === true || N === false || d.call(N) == "[object Boolean]"
    };
    M.isNull = function (N) {
        return N === null
    };
    M.isUndefined = function (N) {
        return N === void 0
    };
    M.has = function (O, N) {
        return j.call(O, N)
    };
    M.noConflict = function () {
        w._ = k;
        return this
    };
    M.identity = function (N) {
        return N
    };
    M.times = function (R, Q, P) {
        var N = Array(Math.max(0, R));
        for (var O = 0; O < R; O++) {
            N[O] = Q.call(P, O)
        }
        return N
    };
    M.random = function (O, N) {
        if (N == null) {
            N = O;
            O = 0
        }
        return O + Math.floor(Math.random() * (N - O + 1))
    };
    var m = {
        escape: {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#x27;",
            "/": "&#x2F;"
        }
    };
    m.unescape = M.invert(m.escape);
    var K = {
        escape: new RegExp("[" + M.keys(m.escape).join("") + "]", "g"),
        unescape: new RegExp("(" + M.keys(m.unescape).join("|") + ")", "g")
    };
    M.each(["escape", "unescape"], function (N) {
        M[N] = function (O) {
            if (O == null) {
                return ""
            }
            return ("" + O).replace(K[N], function (P) {
                return m[N][P]
            })
        }
    });
    M.result = function (N, P) {
        if (N == null) {
            return void 0
        }
        var O = N[P];
        return M.isFunction(O) ? O.call(N) : O
    };
    M.mixin = function (N) {
        I(M.functions(N), function (O) {
            var P = M[O] = N[O];
            M.prototype[O] = function () {
                var Q = [this._wrapped];
                H.apply(Q, arguments);
                return s.call(this, P.apply(M, Q))
            }
        })
    };
    var z = 0;
    M.uniqueId = function (N) {
        var O = ++z + "";
        return N ? N + O : O
    };
    M.templateSettings = {
        evaluate: /<%([\s\S]+?)%>/g,
        interpolate: /<%=([\s\S]+?)%>/g,
        escape: /<%-([\s\S]+?)%>/g
    };
    var v = /(.)^/;
    var h = {
        "'": "'",
        "\\": "\\",
        "\r": "r",
        "\n": "n",
        "\t": "t",
        "\u2028": "u2028",
        "\u2029": "u2029"
    };
    var i = /\\|'|\r|\n|\t|\u2028|\u2029/g;
    M.template = function (V, Q, P) {
        var O;
        P = M.defaults({}, P, M.templateSettings);
        var R = new RegExp([(P.escape || v).source, (P.interpolate || v).source, (P.evaluate || v).source].join("|") + "|$", "g");
        var S = 0;
        var N = "__p+='";
        V.replace(R, function (X, Y, W, aa, Z) {
            N += V.slice(S, Z).replace(i, function (ab) {
                return "\\" + h[ab]
            });
            if (Y) {
                N += "'+\n((__t=(" + Y + "))==null?'':_.escape(__t))+\n'"
            }
            if (W) {
                N += "'+\n((__t=(" + W + "))==null?'':__t)+\n'"
            }
            if (aa) {
                N += "';\n" + aa + "\n__p+='"
            }
            S = Z + X.length;
            return X
        });
        N += "';\n";
        if (!P.variable) {
            N = "with(obj||{}){\n" + N + "}\n"
        }
        N = "var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};\n" + N + "return __p;\n";
        try {
            O = new Function(P.variable || "obj", "_", N)
        } catch (T) {
            T.source = N;
            throw T
        }
        if (Q) {
            return O(Q, M)
        }
        var U = function (W) {
            return O.call(this, W, M)
        };
        U.source = "function(" + (P.variable || "obj") + "){\n" + N + "}";
        return U
    };
    M.chain = function (N) {
        return M(N).chain()
    };
    var s = function (N) {
        return this._chain ? M(N).chain() : N
    };
    M.mixin(M);
    I(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function (N) {
        var O = C[N];
        M.prototype[N] = function () {
            var P = this._wrapped;
            O.apply(P, arguments);
            if ((N == "shift" || N == "splice") && P.length === 0) {
                delete P[0]
            }
            return s.call(this, P)
        }
    });
    I(["concat", "join", "slice"], function (N) {
        var O = C[N];
        M.prototype[N] = function () {
            return s.call(this, O.apply(this._wrapped, arguments))
        }
    });
    M.extend(M.prototype, {
        chain: function () {
            this._chain = true;
            return this
        },
        value: function () {
            return this._wrapped
        }
    })
}).call(this);
/*!
 * This script gives you the zone info key representing your device's time zone setting.
 *
 * @name jsTimezoneDetect
 * @version 1.0.5
 * @author Jon Nylander
 * @license MIT License - http://www.opensource.org/licenses/mit-license.php
 *
 * For usage and examples, visit:
 * http://pellepim.bitbucket.org/jstz/
 *
 * Copyright (c) Jon Nylander
 */
(function (a) {
    var b = (function () {
        var d = "s",
            e = function (l) {
                var m = -l.getTimezoneOffset();
                return (m !== null ? m : 0)
            },
            h = function (m, n, l) {
                var o = new Date();
                if (m !== undefined) {
                    o.setFullYear(m)
                }
                o.setMonth(n);
                o.setDate(l);
                return o
            },
            f = function (l) {
                return e(h(l, 0, 2))
            },
            i = function (l) {
                return e(h(l, 5, 2))
            },
            c = function (m) {
                var n = m.getMonth() > 7,
                    q = n ? i(m.getFullYear()) : f(m.getFullYear()),
                    l = e(m),
                    p = q < 0,
                    o = q - l;
                if (!p && !n) {
                    return o < 0
                }
                return o !== 0
            },
            g = function () {
                var l = f(),
                    m = i(),
                    n = l - m;
                if (n < 0) {
                    return l + ",1"
                } else {
                    if (n > 0) {
                        return m + ",1," + d
                    }
                }
                return l + ",0"
            },
            j = function () {
                var l = g();
                return new b.TimeZone(b.olson.timezones[l])
            },
            k = function (l) {
                var m = new Date(2010, 6, 15, 1, 0, 0, 0),
                    n = {
                        "America/Denver": new Date(2011, 2, 13, 3, 0, 0, 0),
                        "America/Mazatlan": new Date(2011, 3, 3, 3, 0, 0, 0),
                        "America/Chicago": new Date(2011, 2, 13, 3, 0, 0, 0),
                        "America/Mexico_City": new Date(2011, 3, 3, 3, 0, 0, 0),
                        "America/Asuncion": new Date(2012, 9, 7, 3, 0, 0, 0),
                        "America/Santiago": new Date(2012, 9, 3, 3, 0, 0, 0),
                        "America/Campo_Grande": new Date(2012, 9, 21, 5, 0, 0, 0),
                        "America/Montevideo": new Date(2011, 9, 2, 3, 0, 0, 0),
                        "America/Sao_Paulo": new Date(2011, 9, 16, 5, 0, 0, 0),
                        "America/Los_Angeles": new Date(2011, 2, 13, 8, 0, 0, 0),
                        "America/Santa_Isabel": new Date(2011, 3, 5, 8, 0, 0, 0),
                        "America/Havana": new Date(2012, 2, 10, 2, 0, 0, 0),
                        "America/New_York": new Date(2012, 2, 10, 7, 0, 0, 0),
                        "Europe/Helsinki": new Date(2013, 2, 31, 5, 0, 0, 0),
                        "Pacific/Auckland": new Date(2011, 8, 26, 7, 0, 0, 0),
                        "America/Halifax": new Date(2011, 2, 13, 6, 0, 0, 0),
                        "America/Goose_Bay": new Date(2011, 2, 13, 2, 1, 0, 0),
                        "America/Miquelon": new Date(2011, 2, 13, 5, 0, 0, 0),
                        "America/Godthab": new Date(2011, 2, 27, 1, 0, 0, 0),
                        "Europe/Moscow": m,
                        "Asia/Amman": new Date(2013, 2, 29, 1, 0, 0, 0),
                        "Asia/Beirut": new Date(2013, 2, 31, 2, 0, 0, 0),
                        "Asia/Damascus": new Date(2013, 3, 6, 2, 0, 0, 0),
                        "Asia/Jerusalem": new Date(2013, 2, 29, 5, 0, 0, 0),
                        "Asia/Yekaterinburg": m,
                        "Asia/Omsk": m,
                        "Asia/Krasnoyarsk": m,
                        "Asia/Irkutsk": m,
                        "Asia/Yakutsk": m,
                        "Asia/Vladivostok": m,
                        "Asia/Baku": new Date(2013, 2, 31, 4, 0, 0),
                        "Asia/Yerevan": new Date(2013, 2, 31, 3, 0, 0),
                        "Asia/Kamchatka": m,
                        "Asia/Gaza": new Date(2010, 2, 27, 4, 0, 0),
                        "Africa/Cairo": new Date(2010, 4, 1, 3, 0, 0),
                        "Europe/Minsk": m,
                        "Pacific/Apia": new Date(2010, 10, 1, 1, 0, 0, 0),
                        "Pacific/Fiji": new Date(2010, 11, 1, 0, 0, 0),
                        "Australia/Perth": new Date(2008, 10, 1, 1, 0, 0, 0)
                    };
                return n[l]
            };
        return {
            determine: j,
            date_is_dst: c,
            dst_start_for: k
        }
    }());
    b.TimeZone = function (c) {
        var d = {
                "America/Denver": ["America/Denver", "America/Mazatlan"],
                "America/Chicago": ["America/Chicago", "America/Mexico_City"],
                "America/Santiago": ["America/Santiago", "America/Asuncion", "America/Campo_Grande"],
                "America/Montevideo": ["America/Montevideo", "America/Sao_Paulo"],
                "Asia/Beirut": ["Asia/Amman", "Asia/Jerusalem", "Asia/Beirut", "Europe/Helsinki", "Asia/Damascus"],
                "Pacific/Auckland": ["Pacific/Auckland", "Pacific/Fiji"],
                "America/Los_Angeles": ["America/Los_Angeles", "America/Santa_Isabel"],
                "America/New_York": ["America/Havana", "America/New_York"],
                "America/Halifax": ["America/Goose_Bay", "America/Halifax"],
                "America/Godthab": ["America/Miquelon", "America/Godthab"],
                "Asia/Dubai": ["Europe/Moscow"],
                "Asia/Dhaka": ["Asia/Yekaterinburg"],
                "Asia/Jakarta": ["Asia/Omsk"],
                "Asia/Shanghai": ["Asia/Krasnoyarsk", "Australia/Perth"],
                "Asia/Tokyo": ["Asia/Irkutsk"],
                "Australia/Brisbane": ["Asia/Yakutsk"],
                "Pacific/Noumea": ["Asia/Vladivostok"],
                "Pacific/Tarawa": ["Asia/Kamchatka", "Pacific/Fiji"],
                "Pacific/Tongatapu": ["Pacific/Apia"],
                "Asia/Baghdad": ["Europe/Minsk"],
                "Asia/Baku": ["Asia/Yerevan", "Asia/Baku"],
                "Africa/Johannesburg": ["Asia/Gaza", "Africa/Cairo"]
            },
            e = c,
            g = function () {
                var h = d[e],
                    k = h.length,
                    j = 0,
                    l = h[0];
                for (; j < k; j += 1) {
                    l = h[j];
                    if (b.date_is_dst(b.dst_start_for(l))) {
                        e = l;
                        return
                    }
                }
            },
            f = function () {
                return typeof (d[e]) !== "undefined"
            };
        if (f()) {
            g()
        }
        return {
            name: function () {
                return e
            }
        }
    };
    b.olson = {};
    b.olson.timezones = {
        "-720,0": "Pacific/Majuro",
        "-660,0": "Pacific/Pago_Pago",
        "-600,1": "America/Adak",
        "-600,0": "Pacific/Honolulu",
        "-570,0": "Pacific/Marquesas",
        "-540,0": "Pacific/Gambier",
        "-540,1": "America/Anchorage",
        "-480,1": "America/Los_Angeles",
        "-480,0": "Pacific/Pitcairn",
        "-420,0": "America/Phoenix",
        "-420,1": "America/Denver",
        "-360,0": "America/Guatemala",
        "-360,1": "America/Chicago",
        "-360,1,s": "Pacific/Easter",
        "-300,0": "America/Bogota",
        "-300,1": "America/New_York",
        "-270,0": "America/Caracas",
        "-240,1": "America/Halifax",
        "-240,0": "America/Santo_Domingo",
        "-240,1,s": "America/Santiago",
        "-210,1": "America/St_Johns",
        "-180,1": "America/Godthab",
        "-180,0": "America/Argentina/Buenos_Aires",
        "-180,1,s": "America/Montevideo",
        "-120,0": "America/Noronha",
        "-120,1": "America/Noronha",
        "-60,1": "Atlantic/Azores",
        "-60,0": "Atlantic/Cape_Verde",
        "0,0": "UTC",
        "0,1": "Europe/London",
        "60,1": "Europe/Berlin",
        "60,0": "Africa/Lagos",
        "60,1,s": "Africa/Windhoek",
        "120,1": "Asia/Beirut",
        "120,0": "Africa/Johannesburg",
        "180,0": "Asia/Baghdad",
        "180,1": "Europe/Moscow",
        "210,1": "Asia/Tehran",
        "240,0": "Asia/Dubai",
        "240,1": "Asia/Baku",
        "270,0": "Asia/Kabul",
        "300,1": "Asia/Yekaterinburg",
        "300,0": "Asia/Karachi",
        "330,0": "Asia/Kolkata",
        "345,0": "Asia/Kathmandu",
        "360,0": "Asia/Dhaka",
        "360,1": "Asia/Omsk",
        "390,0": "Asia/Rangoon",
        "420,1": "Asia/Krasnoyarsk",
        "420,0": "Asia/Jakarta",
        "480,0": "Asia/Shanghai",
        "480,1": "Asia/Irkutsk",
        "525,0": "Australia/Eucla",
        "525,1,s": "Australia/Eucla",
        "540,1": "Asia/Yakutsk",
        "540,0": "Asia/Tokyo",
        "570,0": "Australia/Darwin",
        "570,1,s": "Australia/Adelaide",
        "600,0": "Australia/Brisbane",
        "600,1": "Asia/Vladivostok",
        "600,1,s": "Australia/Sydney",
        "630,1,s": "Australia/Lord_Howe",
        "660,1": "Asia/Kamchatka",
        "660,0": "Pacific/Noumea",
        "690,0": "Pacific/Norfolk",
        "720,1,s": "Pacific/Auckland",
        "720,0": "Pacific/Tarawa",
        "765,1,s": "Pacific/Chatham",
        "780,0": "Pacific/Tongatapu",
        "780,1,s": "Pacific/Apia",
        "840,0": "Pacific/Kiritimati"
    };
    if (typeof exports !== "undefined") {
        exports.jstz = b
    } else {
        a.jstz = b
    }
})(this);
/*!
The MIT License (MIT)

Copyright (c) 2013 Telerik AD

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.y distributed under the MIT license.
*/
/*!
 Everlive SDK
 Version 1.2.14
 */
(function (b, c) {
    if (typeof define === "function" && define.amd) {
        define(["underscore", "rsvp", "reqwest", "jstz"], function (i, h, f, g) {
            return (b.Everlive = c(i, h, f, g))
        })
    } else {
        if (typeof (isNativeScriptApplication) !== "undefined" && isNativeScriptApplication) {
            var e = {
                Promise: Promise
            };
            b.RSVP = e;
            var d = require("http");
            var a = function (g) {
                var j = {
                    url: g.url,
                    method: g.method,
                    headers: g.headers || {}
                };
                if (g.data) {
                    j.content = g.data
                }
                j.headers.Accept = "application/json";
                j.headers["Content-Type"] = "application/json";
                var h = function () {};
                var i = g.success || h;
                var f = g.error || h;
                d.request(j).then(function (k) {
                    var l = k.content.toString();
                    if (k.statusCode < 400) {
                        i(l)
                    } else {
                        f({
                            responseText: l
                        })
                    }
                }, function (k) {
                    f({
                        responseText: k
                    })
                })
            };
            b.reqwest = a;
            module.exports = c(exports._, b.RSVP, b.reqwest, exports.jstz)
        } else {
            if (typeof exports === "object") {
                module.exports = c(require("underscore"), require("rsvp"))
            } else {
                b.Everlive = c(b._, b.RSVP, b.reqwest, b.jstz)
            }
        }
    }
}(this, function (B, k, m, h) {
    var q = Array.prototype.slice;
    var E = "//api.everlive.com/v1/";
    var i = "Id";

    function a(H, F, G) {
        if (!G) {
            G = "The " + F + " is required"
        }
        if (typeof H === "undefined" || H === null) {
            throw new c(G)
        }
    }

    function x(F) {
        this.url = E;
        this.apiKey = null;
        this.masterKey = null;
        this.token = null;
        this.tokenType = null;
        this.scheme = "http";
        this.parseOnlyCompleteDateTimeObjects = false;
        if (typeof F === "string") {
            this.apiKey = F
        } else {
            this._emulatorMode = F.emulatorMode;
            B.extend(this, F)
        }
    }

    function s(G) {
        var F = this;
        this.setup = new x(G);
        B.each(t, function (H) {
            H.func.call(F, G)
        });
        if (s.$ === null) {
            s.$ = F
        }
    }
    s.$ = null;
    s.idField = i;
    var t = [];
    s.initializations = t;
    s.init = function (F) {
        s.$ = null;
        return new s(F)
    };
    s.buildUrl = function (F) {
        var G = "";
        if (typeof F.scheme === "string") {
            G += F.scheme + ":"
        }
        G += F.url;
        if (F.apiKey) {
            G += F.apiKey + "/"
        }
        return G
    };
    s.prototype.data = function (F) {
        return new f(this.setup, F)
    };
    s.prototype.buildUrl = function () {
        return s.buildUrl(this.setup)
    };
    var r = function (G, H) {
        var F = null;
        if (H && H.authHeaders === false) {
            return F
        }
        if (G.token) {
            F = (G.tokenType || "bearer") + " " + G.token
        } else {
            if (G.masterKey) {
                F = "masterkey " + G.masterKey
            }
        }
        if (F) {
            return {
                Authorization: F
            }
        } else {
            return null
        }
    };
    s.prototype.buildAuthHeader = function () {
        return r(this.setup)
    };
    (function () {
        var L = {
            query: 1,
            where: 100,
            filter: 101,
            and: 110,
            or: 111,
            not: 112,
            equal: 120,
            not_equal: 121,
            lt: 122,
            lte: 123,
            gt: 124,
            gte: 125,
            isin: 126,
            notin: 127,
            all: 128,
            size: 129,
            regex: 130,
            contains: 131,
            startsWith: 132,
            endsWith: 133,
            nearShpere: 140,
            withinBox: 141,
            withinPolygon: 142,
            withinShpere: 143,
            select: 200,
            exclude: 201,
            order: 300,
            order_desc: 301,
            skip: 400,
            take: 401,
            expand: 402
        };

        function H(M, N) {
            this.operator = M;
            this.operands = N || []
        }
        H.prototype = {
            addOperand: function (M) {
                this.operands.push(M)
            }
        };

        function G(Q, M, O, R, N, P) {
            this.filter = Q;
            this.fields = M;
            this.sort = O;
            this.toskip = R;
            this.totake = N;
            this.expandExpression = P;
            this.expr = new H(L.query)
        }
        G.prototype = {
            where: function (M) {
                if (M) {
                    return this._simple(L.filter, [M])
                } else {
                    return new K(this)
                }
            },
            select: function () {
                return this._simple(L.select, arguments)
            },
            order: function (M) {
                return this._simple(L.order, [M])
            },
            orderDesc: function (M) {
                return this._simple(L.order_desc, [M])
            },
            skip: function (M) {
                return this._simple(L.skip, [M])
            },
            take: function (M) {
                return this._simple(L.take, [M])
            },
            expand: function (M) {
                return this._simple(L.expand, [M])
            },
            build: function () {
                return new J(this).build()
            },
            _simple: function (O, M) {
                var N = q.call(M);
                this.expr.addOperand(new H(O, N));
                return this
            }
        };

        function K(O, N, M) {
            this.parent = O;
            this.single = M;
            this.expr = new H(N || L.where);
            this.parent.expr.addOperand(this.expr)
        }
        K.prototype = {
            and: function () {
                return new K(this, L.and)
            },
            or: function () {
                return new K(this, L.or)
            },
            not: function () {
                return new K(this, L.not, true)
            },
            _simple: function (M) {
                var N = q.call(arguments, 1);
                this.expr.addOperand(new H(M, N));
                return this._done()
            },
            eq: function (N, M) {
                return this._simple(L.equal, N, M)
            },
            ne: function (N, M) {
                return this._simple(L.not_equal, N, M)
            },
            gt: function (N, M) {
                return this._simple(L.gt, N, M)
            },
            gte: function (N, M) {
                return this._simple(L.gte, N, M)
            },
            lt: function (N, M) {
                return this._simple(L.lt, N, M)
            },
            lte: function (N, M) {
                return this._simple(L.lte, N, M)
            },
            isin: function (N, M) {
                return this._simple(L.isin, N, M)
            },
            notin: function (N, M) {
                return this._simple(L.notin, N, M)
            },
            all: function (N, M) {
                return this._simple(L.all, N, M)
            },
            size: function (N, M) {
                return this._simple(L.size, N, M)
            },
            regex: function (O, N, M) {
                return this._simple(L.regex, O, N, M)
            },
            startsWith: function (O, N, M) {
                return this._simple(L.startsWith, O, N, M)
            },
            endsWith: function (O, N, M) {
                return this._simple(L.endsWith, O, N, M)
            },
            nearSphere: function (O, M, P, N) {
                return this._simple(L.nearShpere, O, M, P, N)
            },
            withinBox: function (N, O, M) {
                return this._simple(L.withinBox, N, O, M)
            },
            withinPolygon: function (N, M) {
                return this._simple(L.withinPolygon, N, M)
            },
            withinCenterSphere: function (P, N, M, O) {
                return this._simple(L.withinShpere, P, N, M, O)
            },
            done: function () {
                if (this.parent instanceof K) {
                    return this.parent._done()
                } else {
                    return this.parent
                }
            },
            _done: function () {
                if (this.single) {
                    return this.parent
                } else {
                    return this
                }
            }
        };
        K.prototype.equal = K.prototype.eq;
        K.prototype.notEqual = K.prototype.ne;
        K.prototype.greaterThan = K.prototype.gt;
        K.prototype.greaterThanEqual = K.prototype.gte;
        K.prototype.lessThan = K.prototype.lt;
        K.prototype.lessThanEqual = K.prototype.lte;

        function J(M) {
            this.query = M;
            this.expr = M.expr
        }
        var F = {
            radians: "$maxDistance",
            km: "$maxDistanceInKilometers",
            miles: "$maxDistanceInMiles"
        };
        var I = {
            radians: "radius",
            km: "radiusInKilometers",
            miles: "radiusInMiles"
        };
        J.prototype = {
            build: function () {
                var M = this.query;
                if (M.filter || M.fields || M.sort || M.toskip || M.totake || M.expandExpression) {
                    return {
                        $where: M.filter || null,
                        $select: M.fields || null,
                        $sort: M.sort || null,
                        $skip: M.toskip || null,
                        $take: M.totake || null,
                        $expand: M.expandExpression || null
                    }
                }
                return {
                    $where: this._buildWhere(),
                    $select: this._buildSelect(),
                    $sort: this._buildSort(),
                    $skip: this._getSkip(),
                    $take: this._getTake(),
                    $expand: this._getExpand()
                }
            },
            _getSkip: function () {
                var M = B.find(this.expr.operands, function (P, N, O) {
                    return P.operator === L.skip
                });
                return M ? M.operands[0] : null
            },
            _getTake: function () {
                var M = B.find(this.expr.operands, function (P, N, O) {
                    return P.operator === L.take
                });
                return M ? M.operands[0] : null
            },
            _getExpand: function () {
                var M = B.find(this.expr.operands, function (P, N, O) {
                    return P.operator === L.expand
                });
                return M ? M.operands[0] : null
            },
            _buildSelect: function () {
                var N = B.find(this.expr.operands, function (Q, O, P) {
                    return Q.operator === L.select
                });
                var M = {};
                if (N) {
                    B.reduce(N.operands, function (O, P) {
                        O[P] = 1;
                        return O
                    }, M);
                    return M
                } else {
                    return null
                }
            },
            _buildSort: function () {
                var N = B.filter(this.expr.operands, function (Q, O, P) {
                    return Q.operator === L.order || Q.operator === L.order_desc
                });
                var M = {};
                if (N.length > 0) {
                    B.reduce(N, function (O, P) {
                        O[P.operands[0]] = P.operator === L.order ? 1 : -1;
                        return O
                    }, M);
                    return M
                } else {
                    return null
                }
            },
            _buildWhere: function () {
                var M = B.find(this.expr.operands, function (Q, O, P) {
                    return Q.operator === L.where
                });
                if (M) {
                    return this._build(new H(L.and, M.operands))
                } else {
                    var N = B.find(this.expr.operands, function (Q, O, P) {
                        return Q.operator === L.filter
                    });
                    if (N) {
                        return N.operands[0]
                    }
                    return null
                }
            },
            _build: function (M) {
                if (this._isSimple(M)) {
                    return this._simple(M)
                } else {
                    if (this._isRegex(M)) {
                        return this._regex(M)
                    } else {
                        if (this._isGeo(M)) {
                            return this._geo(M)
                        } else {
                            if (this._isAnd(M)) {
                                return this._and(M)
                            } else {
                                if (this._isOr(M)) {
                                    return this._or(M)
                                } else {
                                    if (this._isNot(M)) {
                                        return this._not(M)
                                    }
                                }
                            }
                        }
                    }
                }
            },
            _isSimple: function (M) {
                return M.operator >= L.equal && M.operator <= L.size
            },
            _simple: function (Q) {
                var P = {},
                    M = {};
                var O = Q.operands;
                var N = this._translateoperator(Q.operator);
                if (N) {
                    P[N] = O[1]
                } else {
                    P = O[1]
                }
                M[O[0]] = P;
                return M
            },
            _isRegex: function (M) {
                return M.operator >= L.regex && M.operator <= L.endsWith
            },
            _regex: function (Q) {
                var M = {};
                var P = this._getRegex(Q);
                var N = this._getRegexValue(P);
                var O = Q.operands;
                M[O[0]] = N;
                return M
            },
            _getRegex: function (O) {
                var N = O.operands[1];
                var M = O.operands[2] ? O.operands[2] : "";
                switch (O.operator) {
                    case L.regex:
                        return N instanceof RegExp ? N : new RegExp(N, M);
                    case L.startsWith:
                        return new RegExp("^" + N, M);
                    case L.endsWith:
                        return new RegExp(N + "$", M);
                    default:
                        throw new c("Unknown operator type.")
                }
            },
            _getRegexValue: function (N) {
                var M = "";
                if (N.global) {
                    M += "g"
                }
                if (N.multiline) {
                    M += "m"
                }
                if (N.ignoreCase) {
                    M += "i"
                }
                return {
                    $regex: N.source,
                    $options: M
                }
            },
            _isGeo: function (M) {
                return M.operator >= L.nearShpere && M.operator <= L.withinShpere
            },
            _geo: function (O) {
                var M = {};
                var N = O.operands;
                M[N[0]] = this._getGeoTerm(O);
                return M
            },
            _getGeoTerm: function (M) {
                switch (M.operator) {
                    case L.nearShpere:
                        return this._getNearSphereTerm(M);
                    case L.withinBox:
                        return this._getWithinBox(M);
                    case L.withinPolygon:
                        return this._getWithinPolygon(M);
                    case L.withinShpere:
                        return this._getWithinCenterSphere(M);
                    default:
                        throw new c("Unknown operator type.")
                }
            },
            _getNearSphereTerm: function (S) {
                var O = S.operands;
                var M = this._getGeoPoint(O[1]);
                var R = O[2];
                var Q = O[3];
                var N;
                var P = {
                    "$nearSphere": M
                };
                if (typeof R !== "undefined") {
                    N = F[Q] || F.radians;
                    P[N] = R
                }
                return P
            },
            _getWithinBox: function (P) {
                var N = P.operands;
                var M = this._getGeoPoint(N[1]);
                var O = this._getGeoPoint(N[2]);
                return {
                    "$within": {
                        "$box": [M, O]
                    }
                }
            },
            _getWithinPolygon: function (O) {
                var M = O.operands;
                var N = this._getGeoPoints(M[1]);
                return {
                    "$within": {
                        "$polygon": N
                    }
                }
            },
            _getWithinCenterSphere: function (S) {
                var Q = S.operands;
                var N = this._getGeoPoint(Q[1]);
                var M = Q[2];
                var R = Q[3];
                var O = I[R] || I.radians;
                var P = {
                    center: N
                };
                P[O] = M;
                return {
                    "$within": {
                        "$centerSphere": P
                    }
                }
            },
            _getGeoPoint: function (M) {
                if (B.isArray(M)) {
                    return new n(M[0], M[1])
                }
                return M
            },
            _getGeoPoints: function (N) {
                var M = this;
                return B.map(N, function (O) {
                    return M._getGeoPoint(O)
                })
            },
            _isAnd: function (M) {
                return M.operator === L.and
            },
            _and: function (R) {
                var Q, N, P, M = {};
                var O = R.operands;
                for (Q = 0, N = O.length; Q < N; Q++) {
                    P = this._build(O[Q]);
                    M = this._andAppend(M, P)
                }
                return M
            },
            _andAppend: function (Q, N) {
                var P, M, O, S, T;
                var R = B.keys(N);
                for (P = 0, M = R.length; P < M; P++) {
                    O = R[P];
                    S = Q[O];
                    if (typeof S === "undefined") {
                        Q[O] = N[O]
                    } else {
                        T = N[O];
                        if (typeof S === "object" && typeof T === "object") {
                            S = B.extend(S, T)
                        } else {
                            S = T
                        }
                        Q[O] = S
                    }
                }
                return Q
            },
            _isOr: function (M) {
                return M.operator === L.or
            },
            _or: function (R) {
                var Q, N, P, M = [];
                var O = R.operands;
                for (Q = 0, N = O.length; Q < N; Q++) {
                    P = this._build(O[Q]);
                    M.push(P)
                }
                return {
                    $or: M
                }
            },
            _isNot: function (M) {
                return M.operator === L.not
            },
            _not: function (M) {
                return {
                    $not: this._build(M.operands[0])
                }
            },
            _translateoperator: function (M) {
                switch (M) {
                    case L.equal:
                        return null;
                    case L.not_equal:
                        return "$ne";
                    case L.gt:
                        return "$gt";
                    case L.lt:
                        return "$lt";
                    case L.gte:
                        return "$gte";
                    case L.lte:
                        return "$lte";
                    case L.isin:
                        return "$in";
                    case L.notin:
                        return "$nin";
                    case L.all:
                        return "$all";
                    case L.size:
                        return "$size"
                }
                throw new c("Unknown operator type.")
            }
        };
        s.Query = G;
        s.QueryBuilder = J
    }());
    var w = (function () {
        var Q = {
            filter: "X-Everlive-Filter",
            select: "X-Everlive-Fields",
            sort: "X-Everlive-Sort",
            skip: "X-Everlive-Skip",
            take: "X-Everlive-Take",
            expand: "X-Everlive-Expand"
        };
        var M = null;

        function G(T, U) {
            a(T, "setup");
            a(U, "options");
            this.setup = T;
            this.method = null;
            this.endpoint = null;
            this.data = null;
            this.headers = {};
            this.success = null;
            this.error = null;
            this.parse = G.parsers.simple;
            B.extend(this, U);
            this._init(U);
            M = this
        }
        G.prototype = {
            send: function () {
                s.sendRequest(this)
            },
            buildAuthHeader: r,
            buildUrl: function O(T) {
                return s.buildUrl(T)
            },
            buildQueryHeaders: function J(T) {
                if (T) {
                    if (T instanceof s.Query) {
                        return G.prototype._buildQueryHeaders(T)
                    } else {
                        return G.prototype._buildFilterHeader(T)
                    }
                } else {
                    return {}
                }
            },
            _init: function (T) {
                B.extend(this.headers, this.buildAuthHeader(this.setup, T), this.buildQueryHeaders(T.filter), T.headers)
            },
            _buildQueryHeaders: function (T) {
                T = T.build();
                var U = {};
                if (T.$where !== null) {
                    U[Q.filter] = JSON.stringify(T.$where)
                }
                if (T.$select !== null) {
                    U[Q.select] = JSON.stringify(T.$select)
                }
                if (T.$sort !== null) {
                    U[Q.sort] = JSON.stringify(T.$sort)
                }
                if (T.$skip !== null) {
                    U[Q.skip] = T.$skip
                }
                if (T.$take !== null) {
                    U[Q.take] = T.$take
                }
                if (T.$expand !== null) {
                    U[Q.expand] = JSON.stringify(T.$expand)
                }
                return U
            },
            _buildFilterHeader: function (T) {
                var U = {};
                U[Q.filter] = JSON.stringify(T);
                return U
            }
        };
        s.Request = G;
        var S = {
            GET: "GET",
            POST: "POST",
            PUT: "PUT",
            DELETE: "DELETE"
        };
        s.prototype.request = function (T) {
            return new G(this.setup, T)
        };

        function R(X) {
            if (M && M.setup && M.setup.parseOnlyCompleteDateTimeObjects) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(X)) {
                    return null
                }
                if (/^(\d{2}):(\d{2})(:(\d{2})(\.(\d+))?)?(Z|((\+|-)(\d{2}):(\d{2})))?$/.test(X)) {
                    return null
                }
            }
            var W;
            if (W = X.match(/^(\d{4})(-(\d{2})(-(\d{2})(T(\d{2}):(\d{2})(:(\d{2})(\.(\d+))?)?(Z|((\+|-)(\d{2}):(\d{2}))))?))$/)) {
                var U = W[12];
                if (U) {
                    if (U.length > 3) {
                        U = Math.round(Number(U.substr(0, 3) + "." + U.substr(3)))
                    } else {
                        if (U.length < 3) {
                            U += U.length === 2 ? "0" : "00"
                        }
                    }
                }
                var V = new Date(Date.UTC(Number(W[1]), (Number(W[3]) - 1) || 0, Number(W[5]) || 0, Number(W[7]) || 0, Number(W[8]) || 0, Number(W[10]) || 0, Number(U) || 0));
                if (W[13] && W[13] !== "Z") {
                    var Y = Number(W[16]) || 0,
                        T = Number(W[17]) || 0;
                    Y *= 3600000;
                    T *= 60000;
                    var Z = Y + T;
                    if (W[15] === "+") {
                        Z = -Z
                    }
                    V = new Date(V.valueOf() + Z)
                }
                return V
            } else {
                return null
            }
        }

        function N(U, V) {
            if (typeof V === "string") {
                var T = R(V);
                if (T) {
                    V = T
                }
            }
            return V
        }

        function K(X, U) {
            var T, V, W;
            for (T in X) {
                if (X.hasOwnProperty(T)) {
                    V = X[T];
                    W = U(T, V);
                    X[T] = W;
                    if (V === W && typeof V === "object") {
                        K(V, U)
                    }
                }
            }
        }

        function F(T) {
            K(T, N)
        }
        s._traverseAndRevive = F;

        function H(T) {
            if (typeof T === "string" && T.length > 0) {
                T = JSON.parse(T, N)
            } else {
                if (typeof T === "object") {
                    F(T)
                }
            }
            if (T) {
                return {
                    result: T.Result,
                    count: T.Count
                }
            } else {
                return T
            }
        }

        function I(T) {
            if (typeof T === "string" && T.length > 0) {
                try {
                    T = JSON.parse(T);
                    return {
                        message: T.message,
                        code: T.errorCode
                    }
                } catch (U) {
                    return T
                }
            } else {
                return T
            }
        }

        function P(T) {
            if (typeof T === "string" && T.length > 0) {
                T = JSON.parse(T, N)
            } else {
                if (typeof T === "object") {
                    F(T)
                }
            }
            if (T) {
                return {
                    result: T.Result
                }
            } else {
                return T
            }
        }

        function L(T) {
            if (typeof T === "string" && T.length > 0) {
                T = JSON.parse(T, N)
            } else {
                if (typeof T === "object") {
                    F(T)
                }
            }
            if (T) {
                return {
                    result: T.Result,
                    ModifiedAt: T.ModifiedAt
                }
            } else {
                return T
            }
        }
        G.parsers = {
            simple: {
                result: H,
                error: I
            },
            single: {
                result: P,
                error: I
            },
            update: {
                result: L,
                error: I
            }
        };
        s.disableRequestCache = function (T, W) {
            if (W === "GET") {
                var U = (new Date()).getTime();
                var V = T.indexOf("?") > -1 ? "&" : "?";
                T += V + "_el=" + U
            }
            return T
        };
        if (typeof s.sendRequest === "undefined") {
            s.sendRequest = function (U) {
                var T = U.buildUrl(U.setup) + U.endpoint;
                T = s.disableRequestCache(T, U.method);
                var V = U.method === "GET" ? U.data : JSON.stringify(U.data);
                m({
                    url: T,
                    method: U.method,
                    data: V,
                    headers: U.headers,
                    type: "json",
                    contentType: "application/json",
                    crossOrigin: true,
                    success: function (X, Y, W) {
                        U.success.call(U, U.parse.result(X))
                    },
                    error: function (W, Y, X) {
                        U.error.call(U, U.parse.error(W.responseText))
                    }
                })
            }
        }
        return G
    }());
    s.getCallbacks = function (H, F) {
        var G;
        if (typeof H !== "function" && typeof F !== "function") {
            G = new k.Promise(function (J, I) {
                H = function (K) {
                    J(K)
                };
                F = function (K) {
                    I(K)
                }
            })
        }
        return {
            promise: G,
            success: H,
            error: F
        }
    };

    function v(F, I, G) {
        var H = s.getCallbacks(I, G);
        F(H.success, H.error);
        return H.promise
    }

    function A(F, G) {
        return function (J, H) {
            var I = J.result;
            if (B.isArray(F) || typeof F.length === "number") {
                B.each(F, function (L, K) {
                    B.extend(L, I[K])
                })
            } else {
                B.extend(F, I)
            }
            G(J, H)
        }
    }

    function l(F, G) {
        return function (I) {
            var H = I.ModifiedAt;
            F.ModifiedAt = H;
            G(I)
        }
    }

    function f(F, G) {
        this.setup = F;
        this.collectionName = G;
        this.options = null
    }
    f.prototype = {
        withHeaders: function (G) {
            var F = this.options || {};
            F.headers = B.extend(F.headers || {}, G);
            this.options = F;
            return this
        },
        expand: function (G) {
            var F = {
                "X-Everlive-Expand": JSON.stringify(G)
            };
            return this.withHeaders(F)
        },
        _createRequest: function (F) {
            B.extend(F, this.options);
            this.options = null;
            return new w(this.setup, F)
        },
        get: function (H, I, G) {
            var F = this;
            return v(function (L, J) {
                var K = F._createRequest({
                    method: "GET",
                    endpoint: F.collectionName,
                    filter: H,
                    success: L,
                    error: J
                });
                K.send()
            }, I, G)
        },
        getById: function (I, H, G) {
            var F = this;
            return v(function (L, J) {
                var K = F._createRequest({
                    method: "GET",
                    endpoint: F.collectionName + "/" + I,
                    parse: w.parsers.single,
                    success: L,
                    error: J
                });
                K.send()
            }, H, G)
        },
        count: function (H, I, G) {
            var F = this;
            return v(function (L, J) {
                var K = F._createRequest({
                    method: "GET",
                    endpoint: F.collectionName + "/_count",
                    filter: H,
                    parse: w.parsers.single,
                    success: L,
                    error: J
                });
                K.send()
            }, I, G)
        },
        create: function (H, I, G) {
            var F = this;
            return v(function (L, J) {
                var K = F._createRequest({
                    method: "POST",
                    endpoint: F.collectionName,
                    data: H,
                    parse: w.parsers.single,
                    success: A(H, L),
                    error: J
                });
                K.send()
            }, I, G)
        },
        rawUpdate: function (H, I, J, G) {
            var F = this;
            return v(function (O, L) {
                var N = F.collectionName;
                var K = null;
                if (typeof I === "string") {
                    N += "/" + I
                } else {
                    if (typeof I === "object") {
                        K = I
                    }
                }
                var M = F._createRequest({
                    method: "PUT",
                    endpoint: N,
                    data: H,
                    filter: K,
                    success: O,
                    error: L
                });
                M.send()
            }, J, G)
        },
        _update: function (H, J, L, I, K, G) {
            var F = this;
            return v(function (R, M) {
                var Q = F.collectionName;
                var O = R;
                if (L) {
                    Q += "/" + H[i];
                    O = l(H, R)
                }
                var P = {};
                P[I ? "$replace" : "$set"] = H;
                var N = F._createRequest({
                    method: "PUT",
                    endpoint: Q,
                    parse: w.parsers.update,
                    data: P,
                    filter: J,
                    success: O,
                    error: M
                });
                N.send()
            }, K, G)
        },
        updateSingle: function (G, H, F) {
            return this._update(G, null, true, false, H, F)
        },
        update: function (G, H, I, F) {
            return this._update(G, H, false, false, I, F)
        },
        _destroy: function (H, I, K, J, G) {
            var F = this;
            return v(function (O, L) {
                var N = F.collectionName;
                if (K) {
                    N += "/" + H[i]
                }
                var M = F._createRequest({
                    method: "DELETE",
                    endpoint: N,
                    filter: I,
                    success: O,
                    error: L
                });
                M.send()
            }, J, G)
        },
        destroySingle: function (G, H, F) {
            return this._destroy(G, null, true, H, F)
        },
        destroy: function (G, H, F) {
            return this._destroy(null, G, false, H, F)
        },
        setAcl: function (J, H, I, G) {
            var F = this;
            return v(function (O, K) {
                var N = F.collectionName;
                if (typeof H === "string") {
                    N += "/" + H
                } else {
                    if (typeof H === "object") {
                        N += "/" + H[i]
                    }
                }
                N += "/_acl";
                var P, M;
                if (J === null) {
                    P = "DELETE"
                } else {
                    P = "PUT";
                    M = J
                }
                var L = F._createRequest({
                    method: P,
                    endpoint: N,
                    data: M,
                    success: O,
                    error: K
                });
                L.send()
            }, I, G)
        },
        setOwner: function (F, I, J, H) {
            var G = this;
            return v(function (N, K) {
                var M = G.collectionName;
                if (typeof I === "string") {
                    M += "/" + I
                } else {
                    if (typeof I === "object") {
                        M += "/" + I[i]
                    }
                }
                M += "/_owner";
                var L = G._createRequest({
                    method: "PUT",
                    endpoint: M,
                    data: {
                        Owner: F
                    },
                    success: N,
                    error: K
                });
                L.send()
            }, J, H)
        },
        save: function (I, J, H) {
            var G = this;
            var F = this.isNew(I);
            return v(function (N, K) {
                function M(O) {
                    O.type = F ? "create" : "update";
                    N(O)
                }

                function L(O) {
                    O.type = F ? "create" : "update";
                    K(O)
                }
                if (F) {
                    return G.create(I, M, L)
                } else {
                    return G.updateSingle(I, M, L)
                }
            }, J, H)
        },
        isNew: function (F) {
            return typeof F[i] === "undefined"
        }
    };
    s.Data = f;

    function n(F, G) {
        this.longitude = F || 0;
        this.latitude = G || 0
    }
    s.GeoPoint = n;
    var g = {
        unauthenticated: "unauthenticated",
        masterKey: "masterKey",
        invalidAuthentication: "invalidAuthentication",
        authenticated: "authenticated"
    };
    s.AuthStatus = g;

    function j(F, I, K, H) {
        if (F.masterKey) {
            return v(function (M, L) {
                M({
                    status: g.masterKey
                })
            }, K, H)
        }
        if (!F.token) {
            return v(function (M, L) {
                M({
                    status: g.unauthenticated
                })
            }, K, H)
        }
        var G;
        if (K) {
            G = function (L) {
                if (L && L.code === 601) {
                    K({
                        status: g.invalidAuthentication
                    })
                } else {
                    H(L)
                }
            }
        }
        var J = I(K, G);
        if (J) {
            J = J.then(function (L) {
                return {
                    status: g.authenticated,
                    user: L.result
                }
            }, function (L) {
                if (L && L.code === 601) {
                    return {
                        status: g.invalidAuthentication
                    }
                } else {
                    throw L
                }
            })
        }
        return J
    }
    s.prototype.authInfo = function (G, F) {
        return j(this.setup, B.bind(this.Users.getById, this.Users, "me"), G, F)
    };
    var d = function (H) {
        H._loginSuccess = function (J) {
            var I = J.result;
            this.setAuthorization(I.access_token, I.token_type)
        };
        H._logoutSuccess = function () {
            this.clearAuthorization()
        };
        H.register = function (N, L, K, M, J) {
            a(N, "username");
            a(L, "password");
            var I = {
                Username: N,
                Password: L
            };
            B.extend(I, K);
            return this.create(I, M, J)
        };
        H.login = function (M, K, L, J) {
            var I = this;
            return v(function (P, N) {
                var O = new w(I.setup, {
                    method: "POST",
                    endpoint: "oauth/token",
                    data: {
                        username: M,
                        password: K,
                        grant_type: "password"
                    },
                    authHeaders: false,
                    parse: w.parsers.single,
                    success: function () {
                        I._loginSuccess.apply(I, arguments);
                        P.apply(null, arguments)
                    },
                    error: N
                });
                O.send()
            }, L, J)
        };
        H.currentUser = function (K, J) {
            var I = this;
            return v(function (M, L) {
                j(I.setup, B.bind(I.getById, I, "me")).then(function (N) {
                    if (typeof N.user !== "undefined") {
                        M({
                            result: N.user
                        })
                    } else {
                        M({
                            result: null
                        })
                    }
                }, function (N) {
                    L(N)
                })
            }, K, J)
        };
        H.changePassword = function (O, K, N, L, M, J) {
            var I = this;
            return v(function (S, P) {
                var R = "Users/changepassword";
                if (L) {
                    R += "?keepTokens=true"
                }
                var Q = new w(I.setup, {
                    method: "POST",
                    endpoint: R,
                    data: {
                        Username: O,
                        Password: K,
                        NewPassword: N
                    },
                    authHeaders: false,
                    parse: w.parsers.single,
                    success: S,
                    error: P
                });
                Q.send()
            }, M, J)
        };
        H.logout = function (K, J) {
            var I = this;
            return v(function (N, L) {
                var M = new w(I.setup, {
                    method: "GET",
                    endpoint: "oauth/logout",
                    success: function () {
                        I._logoutSuccess.apply(I, arguments);
                        N.apply(null, arguments)
                    },
                    error: function (O) {
                        if (O.code === 301) {
                            I.clearAuthorization()
                        }
                        L.apply(null, arguments)
                    }
                });
                M.send()
            }, K, J)
        };
        H._loginWithProvider = function (K, M, L) {
            var J = {
                Identity: K
            };
            var I = this;
            return v(function (P, N) {
                var O = new w(I.setup, {
                    method: "POST",
                    endpoint: "Users",
                    data: J,
                    authHeaders: false,
                    parse: w.parsers.single,
                    success: function () {
                        I._loginSuccess.apply(I, arguments);
                        P.apply(null, arguments)
                    },
                    error: N
                });
                O.send()
            }, M, L)
        };
        H._linkWithProvider = function (J, L, M, K) {
            var I = this;
            return v(function (P, N) {
                var O = new w(I.setup, {
                    method: "POST",
                    endpoint: "Users/" + L + "/link",
                    data: J,
                    parse: w.parsers.single,
                    success: P,
                    error: N
                });
                O.send()
            }, M, K)
        };
        H._unlinkFromProvider = function (M, L, N, K) {
            var J = {
                Provider: M
            };
            var I = this;
            return v(function (Q, O) {
                var P = new w(I.setup, {
                    method: "POST",
                    endpoint: "Users/" + L + "/unlink",
                    data: J,
                    parse: w.parsers.single,
                    success: Q,
                    error: O
                });
                P.send()
            }, N, K)
        };
        H.loginWithFacebook = function (K, L, J) {
            var I = {
                Provider: "Facebook",
                Token: K
            };
            return H._loginWithProvider(I, L, J)
        };
        H.linkWithFacebook = function (L, K, M, J) {
            var I = {
                Provider: "Facebook",
                Token: K
            };
            return H._linkWithProvider(I, L, M, J)
        };
        H.unlinkFromFacebook = function (J, K, I) {
            return H._unlinkFromProvider("Facebook", J, K, I)
        };
        H.loginWithADFS = function (K, L, J) {
            var I = {
                Provider: "ADFS",
                Token: K
            };
            return H._loginWithProvider(I, L, J)
        };
        H.linkWithADFS = function (L, K, M, J) {
            var I = {
                Provider: "ADFS",
                Token: K
            };
            return H._linkWithProvider(I, L, M, J)
        };
        H.unlinkFromADFS = function (J, K, I) {
            return H._unlinkFromProvider("ADFS", J, K, I)
        };
        H.loginWithLiveID = function (K, L, J) {
            var I = {
                Provider: "LiveID",
                Token: K
            };
            return H._loginWithProvider(I, L, J)
        };
        H.linkWithLiveID = function (L, K, M, J) {
            var I = {
                Provider: "LiveID",
                Token: K
            };
            return H._linkWithProvider(I, L, M, J)
        };
        H.unlinkFromLiveID = function (J, K, I) {
            return H._unlinkFromProvider("LiveID", J, K, I)
        };
        H.loginWithGoogle = function (K, L, J) {
            var I = {
                Provider: "Google",
                Token: K
            };
            return H._loginWithProvider(I, L, J)
        };
        H.linkWithGoogle = function (L, K, M, J) {
            var I = {
                Provider: "Google",
                Token: K
            };
            return H._linkWithProvider(I, L, M, J)
        };
        H.unlinkFromGoogle = function (J, K, I) {
            return H._unlinkFromProvider("Google", J, K, I)
        };
        H.loginWithTwitter = function (K, L, M, J) {
            var I = {
                Provider: "Twitter",
                Token: K,
                TokenSecret: L
            };
            return H._loginWithProvider(I, M, J)
        };
        H.linkWithTwitter = function (L, K, M, N, J) {
            var I = {
                Provider: "Twitter",
                Token: K,
                TokenSecret: M
            };
            return H._linkWithProvider(I, L, N, J)
        };
        H.unlinkFromTwitter = function (J, K, I) {
            return H._unlinkFromProvider("Twitter", J, K, I)
        };
        H.setAuthorization = function G(I, J) {
            this.setup.token = I;
            this.setup.tokenType = J
        };
        H.clearAuthorization = function F() {
            this.setAuthorization(null, null)
        }
    };
    var p = function (F) {
        F.getUploadUrl = function () {
            return s.buildUrl(this.setup) + this.collectionName
        };
        F.getDownloadUrl = function (G) {
            return s.buildUrl(this.setup) + this.collectionName + "/" + G + "/Download"
        };
        F._getUpdateUrl = function (G) {
            return this.collectionName + "/" + G + "/Content"
        };
        F.getUpdateUrl = function (G) {
            return s.buildUrl(this.setup) + this._getUpdateUrl(G)
        };
        F.updateContent = function (G, J, K, I) {
            var H = this;
            return v(function (O, L) {
                var N = H._getUpdateUrl(G);
                var M = H._createRequest({
                    method: "PUT",
                    endpoint: N,
                    data: J,
                    success: O,
                    error: L
                });
                M.send()
            }, K, I)
        };
        F.getDownloadUrlById = function (G, J, I) {
            var H = this;
            return v(function (M, K) {
                var L = H._createRequest({
                    method: "GET",
                    endpoint: H.collectionName + "/" + G,
                    parse: w.parsers.single,
                    success: function (N) {
                        M(N.result.Uri)
                    },
                    error: K
                });
                L.send()
            }, J, I)
        }
    };
    var D = {
        WindowsPhone: 1,
        Windows: 2,
        Android: 3,
        iOS: 4,
        OSX: 5,
        Blackberry: 6,
        Nokia: 7,
        Unknown: 100
    };
    s.PushCallbacks = {};

    function o(F) {
        this._el = F;
        this.notifications = F.data("Push/Notifications");
        this.devices = F.data("Push/Devices")
    }
    o.prototype = {
        ensurePushIsAvailable: function () {
            var F = (typeof window !== "undefined" && window.plugins && window.plugins.pushNotification);
            if (!F) {
                throw new c("The push notification plugin is not available. Ensure that the pushNotification plugin is included and use after `deviceready` event has been fired.")
            }
        },
        currentDevice: function (F) {
            this.ensurePushIsAvailable();
            if (arguments.length === 0) {
                F = this._el.setup._emulatorMode
            }
            if (!window.cordova) {
                throw new c("Error: currentDevice() can only be called from within a hybrid mobile app, after 'deviceready' event has been fired.")
            }
            if (!this._currentDevice) {
                this._currentDevice = new b(this)
            }
            this._currentDevice.emulatorMode = F;
            return this._currentDevice
        },
        register: function (K, M, I) {
            this.ensurePushIsAvailable();
            var J = this.currentDevice();
            var H = this;
            K = K || {};
            if (K.android) {
                K.android.senderID = K.android.projectNumber || K.android.senderID
            }
            var F = function (O, P) {
                var N = new e(O);
                P(N)
            };
            var G = function (O, P) {
                var N = C.fromEverliveError(O);
                P(N)
            };
            var L = function (O, R, P) {
                var N = J._getPlatformType(device.platform);
                var Q = N === D.iOS;
                if (Q && K.iOS) {
                    Q = K.iOS.clearBadge !== false
                }
                if (Q) {
                    H.clearBadgeNumber().then(function () {
                        F(O, R)
                    }, function (S) {
                        G(S, P)
                    })
                } else {
                    F(O, R)
                }
            };
            return v(function (O, N) {
                J.enableNotifications(K, function (Q) {
                    var R = Q.token;
                    var P = K.customParameters;
                    J.getRegistration().then(function () {
                        J.updateRegistration(P, function () {
                            L(R, O, N)
                        }, function (S) {
                            G(S, N)
                        })
                    }, function (S) {
                        if (S.code === 801) {
                            J.register(P, function () {
                                L(R, O, N)
                            }, N)
                        } else {
                            G(S, N)
                        }
                    })
                }, function (Q) {
                    var P = C.fromPluginError(Q);
                    N(P)
                })
            }, M, I)
        },
        unregister: function (H, G) {
            this.ensurePushIsAvailable();
            var F = this.currentDevice();
            return F.disableNotifications.apply(F, arguments)
        },
        updateRegistration: function (F, I, H) {
            this.ensurePushIsAvailable();
            var G = this.currentDevice();
            return G.updateRegistration.apply(G, arguments)
        },
        setBadgeNumber: function (F, K, I) {
            this.ensurePushIsAvailable();
            F = parseInt(F);
            if (isNaN(F)) {
                return v(function (M, L) {
                    L(new c("The badge must have a numeric value"))
                }, K, I)
            }
            var H = {};
            var G = this.currentDevice();
            var J = G._getDeviceId();
            H.Id = "HardwareId/" + encodeURIComponent(J);
            H.BadgeCounter = F;
            return v(function (M, L) {
                G._pushHandler.devices.updateSingle(H).then(function () {
                    if (window.plugins && window.plugins.pushNotification) {
                        return window.plugins.pushNotification.setApplicationIconBadgeNumber(M, L, F)
                    } else {
                        return M()
                    }
                }, L)
            }, K, I)
        },
        clearBadgeNumber: function (G, F) {
            this.ensurePushIsAvailable();
            return this.setBadgeNumber(0, G, F)
        },
        getRegistration: function (H, G) {
            this.ensurePushIsAvailable();
            var F = this.currentDevice();
            return F.getRegistration.apply(F, arguments)
        },
        send: function (G, H, F) {
            this.ensurePushIsAvailable();
            return this.notifications.create.apply(this.notifications, arguments)
        },
        areNotificationsEnabled: function (G, I, H) {
            this.ensurePushIsAvailable();
            G = G || {};
            var F = window.plugins.pushNotification;
            return v(function (K, J) {
                F.areNotificationsEnabled(K, J, G)
            }, I, H)
        }
    };
    var b = function (F) {
        this._pushHandler = F;
        this._initSuccessCallback = null;
        this._initErrorCallback = null;
        this._globalFunctionSuffix = null;
        this.pushSettings = null;
        this.pushToken = null;
        this.isInitialized = false;
        this.isInitializing = false;
        this.emulatorMode = false
    };
    b.prototype = {
        enableNotifications: function (F, H, G) {
            this.pushSettings = this._cleanPlatformsPushSettings(F);
            return v(B.bind(this._initialize, this), H, G)
        },
        disableNotifications: function (H, G) {
            var F = this;
            return this.unregister().then(function () {
                return v(function (M, K) {
                    if (F.emulatorMode) {
                        M()
                    } else {
                        var I = window.plugins.pushNotification;
                        var L;
                        var J = F._getPlatformType(device.platform);
                        if (J === D.WindowsPhone) {
                            L = {
                                channelName: F.pushSettings.wp8.channelName
                            }
                        }
                        I.unregister(function () {
                            F.isInitialized = false;
                            M()
                        }, K, L)
                    }
                }, H, G)
            }, G)
        },
        getRegistration: function (H, F) {
            var G = encodeURIComponent(this._getDeviceId());
            return this._pushHandler.devices.getById("HardwareId/" + G, H, F)
        },
        register: function (G, J, H) {
            var F = this;
            var I = {};
            if (G !== undefined) {
                I.Parameters = G
            }
            return this._populateRegistrationObject(I).then(function () {
                return F._pushHandler.devices.create(I, J, H)
            }, H)
        },
        unregister: function (H, F) {
            var G = encodeURIComponent(device.uuid);
            return this._pushHandler.devices.destroySingle({
                Id: "HardwareId/" + G
            }, H, F)
        },
        updateRegistration: function (G, J, H) {
            var F = this;
            var I = {};
            if (G !== undefined) {
                I.Parameters = G
            }
            return this._populateRegistrationObject(I).then(function () {
                I.Id = "HardwareId/" + encodeURIComponent(I.HardwareId);
                return F._pushHandler.devices.updateSingle(I, J, H)
            }, H)
        },
        _initializeInteractivePush: function (G, M, K) {
            var I = window.plugins.pushNotification;
            var J = G.interactiveSettings;
            var F = [];
            if (G.alert) {
                F.push(I.UserNotificationTypes.Alert)
            }
            if (G.badge) {
                F.push(I.UserNotificationTypes.Badge)
            }
            if (G.sound) {
                F.push(I.UserNotificationTypes.Sound)
            }
            var L = function (N) {
                var O = B.find(J.actions, function (P) {
                    return P.identifier === N
                });
                return O
            };
            var H = B.map(J.categories, function (N) {
                return {
                    identifier: N.identifier,
                    actionsForDefaultContext: B.map(N.actionsForDefaultContext, L),
                    actionsForMinimalContext: B.map(N.actionsForMinimalContext, L)
                }
            });
            I.registerUserNotificationSettings(M, K, {
                types: F,
                categories: H
            })
        },
        _initialize: function (Q, O) {
            var S = this;
            if (this.isInitializing) {
                O(new c("Push notifications are currently initializing."));
                return
            }
            if (!this.emulatorMode && (!window.navigator || !window.navigator.globalization)) {
                O(new c("The globalization plugin is not initialized."));
                return
            }
            if (!this.emulatorMode && (!window.plugins || !window.plugins.pushNotification)) {
                O(new c("The push notifications plugin is not initialized."));
                return
            }
            this._initSuccessCallback = Q;
            this._initErrorCallback = O;
            if (this.isInitialized) {
                this._deviceRegistrationSuccess(this.pushToken);
                return
            }
            if (this.emulatorMode) {
                setTimeout(function () {
                    S._deviceRegistrationSuccess("fake_push_token")
                }, 1000);
                return
            }
            this.isInitializing = true;
            var R = this._globalFunctionSuffix;
            if (!R) {
                R = Date.now().toString();
                this._globalFunctionSuffix = R
            }
            var G = window.plugins.pushNotification;
            var J = this._getPlatformType(device.platform);
            if (J === D.iOS) {
                var L = "apnCallback_" + R;
                s.PushCallbacks[L] = B.bind(this._onNotificationAPN, this);
                var N = this.pushSettings.iOS;
                this._validateIOSSettings(N);
                N.ecb = "Everlive.PushCallbacks." + L;
                G.register(B.bind(this._successfulRegistrationAPN, this), B.bind(this._failedRegistrationAPN, this), N)
            } else {
                if (J === D.Android) {
                    var F = "gcmCallback_" + R;
                    s.PushCallbacks[F] = B.bind(this._onNotificationGCM, this);
                    var I = this.pushSettings.android;
                    this._validateAndroidSettings(I);
                    I.ecb = "Everlive.PushCallbacks." + F;
                    G.register(B.bind(this._successSentRegistrationGCM, this), B.bind(this._errorSentRegistrationGCM, this), I)
                } else {
                    if (J === D.WindowsPhone) {
                        var K = "wp8Callback_" + R;
                        var P = "wp8RegistrationSuccessCallback_" + R;
                        var H = "wp8RegistrationErrorCallback_" + R;
                        s.PushCallbacks[K] = B.bind(this._onNotificationWP8, this);
                        s.PushCallbacks[P] = B.bind(this._deviceRegistrationSuccessWP, this);
                        s.PushCallbacks[H] = B.bind(this._deviceRegistrationFailed, this);
                        var M = this.pushSettings.wp8;
                        this._validateWP8Settings(M);
                        M.ecb = "Everlive.PushCallbacks." + K;
                        M.uccb = "Everlive.PushCallbacks." + P;
                        M.errcb = "Everlive.PushCallbacks." + H;
                        G.register(B.bind(this._successSentRegistrationWP8, this), B.bind(this._errorSentRegistrationWP8, this), M)
                    } else {
                        throw new c("The current platform is not supported: " + device.platform)
                    }
                }
            }
        },
        _deviceRegistrationSuccessWP: function (F) {
            this._deviceRegistrationSuccess(F.uri)
        },
        _validateAndroidSettings: function (F) {
            if (!F.senderID) {
                throw new c("Sender ID (project number) is not set in the android settings.")
            }
        },
        _validateWP8Settings: function (F) {
            if (!F.channelName) {
                throw new c("channelName is not set in the WP8 settings.")
            }
        },
        _validateIOSSettings: function (F) {},
        _cleanPlatformsPushSettings: function (G) {
            var I = {};
            G = G || {};
            var F = function F(K, J, L) {
                if (!G[J]) {
                    return
                }
                K[J] = K[J] || {};
                var N = G[J];
                var M = K[J];
                B.each(L, function (O) {
                    if (N.hasOwnProperty(O)) {
                        M[O] = N[O]
                    }
                })
            };
            F(I, "iOS", ["badge", "sound", "alert", "interactiveSettings"]);
            F(I, "android", ["senderID", "projectNumber"]);
            F(I, "wp8", ["channelName"]);
            var H = ["notificationCallbackAndroid", "notificationCallbackIOS", "notificationCallbackWP8"];
            B.each(H, function (J) {
                var K = G[J];
                if (K) {
                    if (typeof K !== "function") {
                        throw new c('The "' + J + '" of the push settings should be a function')
                    }
                    I[J] = G[J]
                }
            });
            if (G.customParameters) {
                I.customParameters = G.customParameters
            }
            return I
        },
        _populateRegistrationObject: function (H, I, G) {
            var F = this;
            return v(function (K, J) {
                if (!F.pushToken) {
                    throw new c("Push token is not available.")
                }
                F._getLocaleName(function (L) {
                    var R = F._getDeviceId();
                    var P = device.model;
                    var N = F._getPlatformType(device.platform);
                    var O = h.determine().name();
                    var M = F.pushToken;
                    var S = L.value;
                    var Q = device.version;
                    H.HardwareId = R;
                    H.HardwareModel = P;
                    H.PlatformType = N;
                    H.PlatformVersion = Q;
                    H.TimeZone = O;
                    H.PushToken = M;
                    H.Locale = S;
                    K()
                }, J)
            }, I, G)
        },
        _getLocaleName: function (G, F) {
            if (this.emulatorMode) {
                G({
                    value: "en_US"
                })
            } else {
                navigator.globalization.getLocaleName(function (H) {
                    G(H)
                }, F);
                navigator.globalization.getLocaleName(function (H) {}, F)
            }
        },
        _getDeviceId: function () {
            return device.uuid
        },
        _getPlatformType: function (G) {
            var F = G.toLowerCase();
            switch (F) {
                case "ios":
                case "iphone":
                case "ipad":
                    return D.iOS;
                case "android":
                    return D.Android;
                case "wince":
                    return D.WindowsPhone;
                case "win32nt":
                    return D.WindowsPhone;
                default:
                    return D.Unknown
            }
        },
        _deviceRegistrationFailed: function (F) {
            this.pushToken = null;
            this.isInitializing = false;
            this.isInitialized = false;
            if (this._initErrorCallback) {
                this._initErrorCallback({
                    error: F
                })
            }
        },
        _deviceRegistrationSuccess: function (F) {
            this.pushToken = F;
            this.isInitializing = false;
            this.isInitialized = true;
            if (this._initSuccessCallback) {
                this._initSuccessCallback({
                    token: F
                })
            }
        },
        _successfulRegistrationAPN: function (G) {
            var F = this;
            if (this.pushSettings.iOS && this.pushSettings.iOS.interactiveSettings) {
                this._initializeInteractivePush(this.pushSettings.iOS, function () {
                    F._deviceRegistrationSuccess(G)
                }, function (H) {
                    throw new c("The interactive push configuration is incorrect: " + H)
                })
            } else {
                this._deviceRegistrationSuccess(G)
            }
        },
        _failedRegistrationAPN: function (F) {
            this._deviceRegistrationFailed(F)
        },
        _successSentRegistrationGCM: function (F) {},
        _successSentRegistrationWP8: function (F) {},
        _errorSentRegistrationWP8: function (F) {
            this._deviceRegistrationFailed(F)
        },
        _errorSentRegistrationGCM: function (F) {
            this._deviceRegistrationFailed(F)
        },
        _onNotificationAPN: function (F) {
            this._raiseNotificationEventIOS(F)
        },
        _onNotificationWP8: function (F) {
            this._raiseNotificationEventWP8(F)
        },
        _onNotificationGCM: function y(F) {
            switch (F.event) {
                case "registered":
                    if (F.regid.length > 0) {
                        this._deviceRegistrationSuccess(F.regid)
                    }
                    break;
                case "message":
                    this._raiseNotificationEventAndroid(F);
                    break;
                case "error":
                    if (!this.pushToken) {
                        this._deviceRegistrationFailed(F)
                    } else {
                        this._raiseNotificationEventAndroid(F)
                    }
                    break;
                default:
                    this._raiseNotificationEventAndroid(F);
                    break
            }
        },
        _raiseNotificationEventAndroid: function (F) {
            if (this.pushSettings.notificationCallbackAndroid) {
                this.pushSettings.notificationCallbackAndroid(F)
            }
        },
        _raiseNotificationEventIOS: function (F) {
            if (this.pushSettings.notificationCallbackIOS) {
                this.pushSettings.notificationCallbackIOS(F)
            }
        },
        _raiseNotificationEventWP8: function (F) {
            if (this.pushSettings.notificationCallbackWP8) {
                this.pushSettings.notificationCallbackWP8(F)
            }
        }
    };

    function c() {
        var F = Error.apply(this, arguments);
        F.name = this.name = "EverliveError";
        this.message = F.message;
        Object.defineProperty(this, "stack", {
            get: function () {
                return F.stack
            }
        });
        return this
    }
    c.prototype = Object.create(Error.prototype);
    c.prototype.toJSON = function () {
        return {
            name: this.name,
            message: this.message,
            stack: this.stack
        }
    };
    var C = function (H, G, F) {
        c.call(this, G);
        this.errorType = H;
        this.message = G;
        if (F !== undefined) {
            this.additionalInformation = F
        }
    };
    C.prototype = Object.create(c.prototype);
    C.fromEverliveError = function (G) {
        var F = new C(u.EverliveError, G.message, G);
        return F
    };
    C.fromPluginError = function (G) {
        var H = "A plugin error occurred";
        if (G) {
            if (typeof G.error === "string") {
                H = G.error
            } else {
                if (typeof G.message === "string") {
                    H = G.message
                }
            }
        }
        var F = new C(u.PluginError, H, G);
        return F
    };
    var u = {
        EverliveError: 1,
        PluginError: 2
    };
    var e = function (F) {
        this.token = F
    };
    var z = function () {
        this.Users = this.data("Users");
        d(this.Users);
        this.Files = this.data("Files");
        p(this.Files);
        this.push = new o(this)
    };
    t.push({
        name: "default",
        func: z
    });
    return s
}));
(function (a, b) {
    if (typeof define === "function" && define.amd) {
        define(["Everlive"], function (c) {
            b(c)
        })
    } else {
        b(a.Everlive)
    }
}(this, function (n) {
    var h = window.jQuery,
        j = window.kendo;
    if (h === undefined || j === undefined) {
        return
    }
    var i = h.extend;
    i(true, j.data, {
        schemas: {
            everlive: {
                type: "json",
                data: function (o) {
                    if (typeof o.ModifiedAt !== "undefined") {
                        return {
                            ModifiedAt: o.ModifiedAt
                        }
                    } else {
                        return o.Result || o
                    }
                },
                total: "Count",
                model: {
                    id: "Id"
                }
            }
        },
        transports: {
            everlive: {
                read: {
                    dataType: "json",
                    type: "GET",
                    cache: false
                },
                update: {
                    dataType: "json",
                    contentType: "application/json",
                    type: "PUT",
                    cache: false
                },
                create: {
                    dataType: "json",
                    contentType: "application/json",
                    type: "POST",
                    cache: false
                },
                destroy: {
                    dataType: "json",
                    type: "DELETE",
                    cache: false
                },
                parameterMap: function (p, o) {
                    if (o === "destroy") {
                        return {}
                    }
                    if (o === "create" || o === "update") {
                        return JSON.stringify(p)
                    }
                    if (o === "read") {
                        return null
                    }
                }
            }
        }
    });

    function l(s) {
        var o = {};
        if (s) {
            if (s.skip) {
                o.$skip = s.skip;
                delete s.skip
            }
            if (s.take) {
                o.$take = s.take;
                delete s.take
            }
            if (s.sort) {
                var r = s.sort;
                var p = {};
                if (!h.isArray(r)) {
                    r = [r]
                }
                h.each(r, function (t, u) {
                    p[u.field] = u.dir === "asc" ? 1 : -1
                });
                o.$sort = p;
                delete s.sort
            }
            if (s.filter) {
                var q = new k().build(s.filter);
                o.$where = q;
                delete s.filter
            }
        }
        return o
    }
    var m = ["startswith", "startsWith", "endswith", "endsWith", "contains"];

    function k() {}
    k.prototype = {
        build: function (o) {
            return this._build(o)
        },
        _build: function (o) {
            if (this._isRaw(o)) {
                return this._raw(o)
            } else {
                if (this._isSimple(o)) {
                    return this._simple(o)
                } else {
                    if (this._isRegex(o)) {
                        return this._regex(o)
                    } else {
                        if (this._isAnd(o)) {
                            return this._and(o)
                        } else {
                            if (this._isOr(o)) {
                                return this._or(o)
                            }
                        }
                    }
                }
            }
        },
        _isRaw: function (o) {
            return o.operator === "_raw"
        },
        _raw: function (p) {
            var o = {};
            o[p.field] = p.value;
            return o
        },
        _isSimple: function (o) {
            return typeof o.logic === "undefined" && !this._isRegex(o)
        },
        _simple: function (r) {
            var q = {},
                o = {};
            var p = this._translateoperator(r.operator);
            if (p) {
                q[p] = r.value
            } else {
                q = r.value
            }
            o[r.field] = q;
            return o
        },
        _isRegex: function (o) {
            return h.inArray(o.operator, m) !== -1
        },
        _regex: function (q) {
            var o = {};
            var r = this._getRegex(q);
            var p = this._getRegexValue(r);
            o[q.field] = p;
            return o
        },
        _getRegex: function (p) {
            var q = p.value;
            var o = p.operator;
            switch (o) {
                case "contains":
                    return new RegExp(".*" + q + ".*", "i");
                case "startsWith":
                case "startswith":
                    return new RegExp("^" + q, "i");
                case "endsWith":
                case "endswith":
                    return new RegExp(q + "$", "i")
            }
            throw new Error("Unknown operator type.")
        },
        _getRegexValue: function (o) {
            return n.QueryBuilder.prototype._getRegexValue.call(this, o)
        },
        _isAnd: function (o) {
            return o.logic === "and"
        },
        _and: function (t) {
            var s, p, r, o = {};
            var q = t.filters;
            for (s = 0, p = q.length; s < p; s++) {
                r = this._build(q[s]);
                o = this._andAppend(o, r)
            }
            return o
        },
        _andAppend: function (p, o) {
            return n.QueryBuilder.prototype._andAppend.call(this, p, o)
        },
        _isOr: function (o) {
            return o.logic === "or"
        },
        _or: function (t) {
            var s, p, r, o = [];
            var q = t.filters;
            for (s = 0, p = q.length; s < p; s++) {
                r = this._build(q[s]);
                o.push(r)
            }
            return {
                $or: o
            }
        },
        _translateoperator: function (o) {
            switch (o) {
                case "eq":
                    return null;
                case "neq":
                    return "$ne";
                case "gt":
                    return "$gt";
                case "lt":
                    return "$lt";
                case "gte":
                    return "$gte";
                case "lte":
                    return "$lte"
            }
            throw new Error("Unknown operator type.")
        }
    };

    function b(o) {
        return new n.Query(o.$where, null, o.$sort, o.$skip, o.$take)
    }
    var g = j.data.RemoteTransport.prototype.setup;
    j.data.RemoteTransport.prototype.setup = function (p, q) {
        if (!p.url && !this.options[q].url && this.options.typeName) {
            var t = this.options.dataProvider || n.$;
            if (!t) {
                throw new Error("You should either specify a url for this transport method, or instantiate an Everlive instance.")
            }
            p.url = n.Request.prototype.buildUrl(t.setup) + this.options.typeName;
            if (q === "update" || q === "destroy") {
                p.url += "/" + p.data[n.idField]
            }
            p.headers = n.Request.prototype.buildAuthHeader(t.setup);
            if (q === "read" && p.data) {
                var r = l(p.data);
                var o = b(r);
                p.headers = h.extend(p.headers, n.Request.prototype.buildQueryHeaders(o))
            }
            if (q === "create" || q === "read" || q === "update") {
                var s = p.success;
                p.success = function (u) {
                    n._traverseAndRevive(u);
                    if (s) {
                        s(u)
                    }
                }
            }
        }
        return g.call(this, p, q)
    };
    var d = [n.idField, "CreatedAt"];
    var c = j.data.Model.prototype.accept;
    j.data.Model.prototype.accept = function (q) {
        var o = this,
            r, p;
        n._traverseAndRevive(q);
        if (q && o.isNew() && q[n.idField]) {
            for (r in o.fields) {
                if (h.inArray(r, d) === -1) {
                    p = o.get(r);
                    q[r] = p
                }
            }
        } else {
            if (q && typeof q.ModifiedAt !== "undefined") {
                for (r in o.fields) {
                    if (r !== "ModifiedAt") {
                        p = o.get(r);
                        q[r] = p
                    }
                }
            }
        }
        c.call(this, q)
    };
    var e = function (p, t) {
        var r = f(t[t.length - 1]);
        var q = t.slice(0, t.length - 1);
        var s = "/_expand";
        for (var o = 0; o < q.length; o++) {
            s += "/" + f(q[o])
        }
        return (function (v, u) {
            return function (x) {
                var w = p + "";
                if (x.Id && u) {
                    w += v + "/" + x.Id + "/" + u
                }
                return w
            }
        }(s, r))
    };
    var a = function (o) {
        if (typeof o === "string") {
            return {}
        } else {
            return {
                "X-Everlive-Filter": JSON.stringify(o.filter),
                "X-Everlive-Sort": JSON.stringify(o.sort),
                "X-Everlive-Single-Field": o.singleField,
                "X-Everlive-Skip": o.skip,
                "X-Everlive-Take": o.take,
                "X-Everlive-Fields": JSON.stringify(o.fields)
            }
        }
    };
    var f = function (o) {
        if (typeof o === "string") {
            return o
        } else {
            if (o.relation) {
                return o.relation
            } else {
                throw new Error("You need to specify a 'relation' for an expand node when using the object notation")
            }
        }
    };
    n.createHierarchicalDataSource = function (p) {
        p = p || {};
        var r = p.expand;
        var o = p.typeName;
        var v = p.dataProvider || n.$;
        delete p.expand;
        delete p.typeName;
        delete p.dataProvider;
        var s;
        if (p.url) {
            s = p.url
        } else {
            if (v && o) {
                s = n.Request.prototype.buildUrl(v.setup) + o
            } else {
                if (!v) {
                    throw new Error("You need to instantiate an Everlive instance in order to create a kendo HierarchicalDataSource.")
                }
                if (!o) {
                    throw new Error("You need to specify a 'typeName' in order to create a kendo HierarchicalDataSource.")
                }
            }
        }
        var u;
        if (r) {
            for (var q = r.length - 1; q >= 0; q--) {
                var u = {
                    model: {
                        hasChildren: f(r[q]),
                        children: {
                            type: "everlive",
                            transport: {
                                read: {
                                    url: e(s, r.slice(0, q + 1)),
                                    headers: a(r[q])
                                }
                            },
                            schema: u
                        }
                    }
                }
            }
        }
        var t = {};
        t.type = "everlive";
        t.transport = {
            typeName: o,
            dataProvider: v
        };
        t.schema = u;
        i(true, t, p);
        return new j.data.HierarchicalDataSource(t)
    };
    n.createDataSource = function (p) {
        p = p || {};
        var o = p.typeName;
        var r = p.dataProvider || n.$;
        if (!r) {
            throw new Error("You need to instantiate an Everlive instance in order to create a kendo DataSource.")
        }
        if (!o) {
            throw new Error("You need to specify a 'typeName' in order to create a kendo DataSource.")
        }
        delete p.typeName;
        delete p.dataProvider;
        var q = {};
        q.type = "everlive";
        q.transport = {
            typeName: o,
            dataProvider: r
        };
        i(true, q, p);
        return new j.data.DataSource(q)
    }
}));