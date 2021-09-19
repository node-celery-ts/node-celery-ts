// BSD 3-Clause License
//
// Copyright (c) 2021, node-celery-ts contributors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
//
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
//
// * Neither the name of the copyright holder nor the names of its
//   contributors may be used to endorse or promote products derived from
//   this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import * as Errors from "../src/errors";
import * as Uri from "../src/uri";

import * as Chai from "chai";
import * as Mocha from "mocha";

/* tslint:disable:no-hardcoded-credentials */

Mocha.describe("Celery.Uri.getScheme", () => {
    Mocha.it("should parse typical schema", () => {
        expectParseToEqual("amqp://h", Uri.Scheme.Amqp);
        expectParseToEqual("amqps://h", Uri.Scheme.AmqpSecure);
        expectParseToEqual("redis://h", Uri.Scheme.Redis);
        expectParseToEqual("redis+socket://h", Uri.Scheme.RedisSocket);
        expectParseToEqual("rediss://h", Uri.Scheme.RedisSecure);
        expectParseToEqual("rediss+socket://h", Uri.Scheme.RedisSocketSecure);
        expectParseToEqual("sentinel://h", Uri.Scheme.RedisSentinel);
        expectParseToEqual("sentinels://h", Uri.Scheme.RedisSentinelSecure);

        expectParseToEqual("amqp://hostname", Uri.Scheme.Amqp);
        expectParseToEqual("amqps://username@hostname", Uri.Scheme.AmqpSecure);
        expectParseToEqual("redis://:password@hostname", Uri.Scheme.Redis);
        expectParseToEqual("redis+socket:///usr/local/bin:",
                           Uri.Scheme.RedisSocket);
        expectParseToEqual("rediss:/hostname/3", Uri.Scheme.RedisSecure);
        expectParseToEqual("rediss+socket://temp/redis.sock?password=password",
                           Uri.Scheme.RedisSocketSecure);
        expectParseToEqual("sentinel://host/0", Uri.Scheme.RedisSentinel);
        expectParseToEqual("sentinels://hostname:65535/12",
                           Uri.Scheme.RedisSentinelSecure);
    });

    Mocha.it("should ignore the case of the schema to parse", () => {
        expectParseToEqual("AmQp://h", Uri.Scheme.Amqp);
        expectParseToEqual("AMQPS://h", Uri.Scheme.AmqpSecure);
        expectParseToEqual("REDis://h", Uri.Scheme.Redis);
        expectParseToEqual("redIS+soCkET://h", Uri.Scheme.RedisSocket);
        expectParseToEqual("redisS://h", Uri.Scheme.RedisSecure);
        expectParseToEqual("rediss+socket://h", Uri.Scheme.RedisSocketSecure);
        expectParseToEqual("SENTINEL://h", Uri.Scheme.RedisSentinel);
        expectParseToEqual("sEnTiNeLs://h", Uri.Scheme.RedisSentinelSecure);
    });

    Mocha.it("should throw if it detects an invalid scheme", () => {
        expectParseToThrow("http://h", Errors.ParseError);
        expectParseToThrow("ftp://h", Errors.ParseError);
        expectParseToThrow("imap://h", Errors.ParseError);
        expectParseToThrow("chrome-extension://h", Errors.ParseError);
        expectParseToThrow("https://h", Errors.ParseError);
    });

    const expectParseToEqual = (uri: string, expected: Uri.Scheme) => {
        Chai.expect(Uri.getScheme(uri)).to.deep.equal(expected);
    };

    const expectParseToThrow = (uri: string, ...rest: Array<any>) => {
        Chai.expect(() => Uri.getScheme(uri)).to.throw(...rest);
    };
});

Mocha.describe("Celery.Uri.parseUri", () => {
    Mocha.it("should parse typical URIs", () => {
        expectParseToEqual(
            "https://google.com",
            {
                authority: { host: "google.com" },
                path: "/",
                raw: "https://google.com",
                scheme: "https",
            }
        );

        expectParseToEqual(
            "http://mary.sue:securepassword@127.0.0.1:22",
            {
                authority: {
                    host: "127.0.0.1",
                    port: 22,
                    userInfo: {
                        pass: "securepassword",
                        user: "mary.sue",
                    },
                },
                path: "/",
                raw: "http://mary.sue:securepassword@127.0.0.1:22",
                scheme: "http",
            }
        );

        expectParseToEqual(
            "redis://:super%20secure@localhost/0",
            {
                authority: {
                    host: "localhost",
                    userInfo: {
                        pass: "super secure",
                        user: "",
                    },
                },
                path: "/0",
                raw: "redis://:super%20secure@localhost/0",
                scheme: "redis",
            }
        );
    });

    Mocha.it("should parse the host and scheme case-insensitively", () => {
        expectParseToEqual("S:", { path: "", raw: "S:", scheme: "s" });
        expectParseToEqual("SChEmE:", {
            path: "",
            raw: "SChEmE:",
            scheme: "scheme"
        });
        expectParseToEqual(
            "s://HOST",
            {
                authority: {
                    host: "host"
                },
                path: "/",
                raw: "s://HOST",
                scheme: "s",
            }
        );
        expectParseToEqual(
            "s://HOST.name",
            {
                authority:
                {
                    host: "host.name"
                },
                path: "/",
                raw: "s://HOST.name",
                scheme: "s",
            }
        );
    });

    Mocha.it("should not parse invalid schemes", () => {
        expectParseToThrow("_://localhost", Errors.ParseError);
        expectParseToThrow("~://localhost", Errors.ParseError);
        expectParseToThrow("+://localhost", Errors.ParseError);
        expectParseToThrow("-://localhost", Errors.ParseError);
        expectParseToThrow("a_://localhost", Errors.ParseError);
        expectParseToThrow("a~://localhost", Errors.ParseError);
        expectParseToThrow("+ab://localhost", Errors.ParseError);
    });

    Mocha.it("should not parse invalid hostnames", () => {
        expectParseToThrow("s://.", Errors.ParseError);
        expectParseToThrow("s://h.", Errors.ParseError);
        expectParseToThrow("s://.h", Errors.ParseError);
        expectParseToThrow("s://h-", Errors.ParseError);
        expectParseToThrow("s://-h", Errors.ParseError);
        expectParseToThrow("s://h.n-", Errors.ParseError);
        expectParseToThrow("s://h-n.", Errors.ParseError);
    });

    Mocha.it("should parse valid queries", () => {
        expectParseToEqual(
            "s://h?key=value",
            {
                authority: { host: "h" },
                path: "/",
                query: { key: "value" },
                raw: "s://h?key=value",
                scheme: "s",
            },
        );

        expectParseToEqual(
            "s://h?key=value&key=value2",
            {
                authority: { host: "h" },
                path: "/",
                query: { key: ["value", "value2"] },
                raw: "s://h?key=value&key=value2",
                scheme: "s",
            },
        );

        expectParseToEqual(
            "s://h?key=",
            {
                authority: { host: "h" },
                path: "/",
                query: { key: "" },
                raw: "s://h?key=",
                scheme: "s",
            },
        );
    });

    Mocha.it("should not parse invalid queries", () => {
        expectParseToThrow("s://h?query =value", Errors.ParseError);
        expectParseToThrow("s://h?q=&", Errors.ParseError);
        expectParseToThrow("s://h?=value", Errors.ParseError);
    });

    Mocha.it("should not parse invalid ports", () => {
        expectParseToThrow("s://h:0x100", Errors.ParseError);
        expectParseToThrow("s://h:0b100", Errors.ParseError);
        expectParseToThrow("s://h:0B100", Errors.ParseError);

        expectParseToThrow("s://h:-100", Errors.ParseError);
        expectParseToThrow("s://h:-1", Errors.ParseError);
        expectParseToThrow("s://h:65536", Errors.ParseError);
        expectParseToThrow("s://h:0x10000", Errors.ParseError);
        expectParseToThrow("s://h:0200000", Errors.ParseError);
        expectParseToThrow("s://h:2147483647", Errors.ParseError);

        expectParseToThrow("s://h:1.0", Errors.ParseError);
        expectParseToThrow("s://h:65536.0", Errors.ParseError);
        expectParseToThrow("s://h:65535.1", Errors.ParseError);
    });

    const expectParseToEqual = (uri: string, expected: Uri.Uri) => {
        Chai.expect(Uri.parseUri(uri)).to.deep.equal(expected);
    };

    const expectParseToThrow = (uri: string, ...rest: Array<any>) => {
        Chai.expect(() => Uri.parseUri(uri)).to.throw(...rest);
    };
});
