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

import * as BasicOptions from "../../src/redis/basic_options";
import * as Uri from "../../src/redis/uri";

import * as Errors from "../../src/errors";

import * as Chai from "chai";
import * as Mocha from "mocha";

/* tslint:disable:no-hardcoded-credentials */

Mocha.describe("Celery.Redis.Uri.Tcp.parse", () => {
    Mocha.it("should parse the usual URIs", () => {
        expectParseToEqual(
            "redis://localhost",
            {
                host: "localhost",
                protocol: "redis",
            }
        );

        expectParseToEqual(
            "rediss://:pass@host:6379/0?key=value&key=value",
            {
                db: 0,
                host: "host",
                password: "pass",
                port: 6379,
                protocol: "rediss",
            }
        );

        expectParseToEqual(
            "REDIS://host",
            {
                host: "host",
                protocol: "redis",
            }
        );

        expectParseToEqual(
            "ReDiSs://host",
            {
                host: "host",
                protocol: "rediss",
            }
        );

        expectParseToEqual(
            "redis://:password@localhost",
            {
                host: "localhost",
                password: "password",
                protocol: "redis",
            }
        );
    });

    Mocha.it("should parse queries", () => {
        expectParseToEqual(
            "redis://localhost?noDelay=true",
            {
                host: "localhost",
                noDelay: true,
                protocol: "redis",
            }
        );
        expectParseToEqual(
            "redis://localhost?noDelay=off",
            {
                host: "localhost",
                noDelay: false,
                protocol: "redis",
            }
        );

        expectParseToEqual(
            "redis://localhost?no_delay=FALSE&irrelevant=",
            {
                host: "localhost",
                noDelay: false,
                protocol: "redis",
            }
        );

        expectParseToEqual(
            "redis://localhost?password=foo",
            {
                host: "localhost",
                password: "foo",
                protocol: "redis",
            }
        );

        expectParseToEqual(
            "redis://:foo@localhost?password=bar",
            {
                host: "localhost",
                password: "bar",
                protocol: "redis",
            }
        );

        expectParseToEqual(
            "redis://localhost?password=%2ffoo",
            {
                host: "localhost",
                password: "/foo",
                protocol: "redis",
            }
        );
    });

    Mocha.it("should not parse invalid URIs", () => {
        expectParseToThrow("amqp://localhost", Errors.ParseError);
        expectParseToThrow("redis://invalid_host", Errors.ParseError);
        expectParseToThrow("redis://host:badport", Errors.ParseError);
        expectParseToThrow("redis://host/baddb", Errors.ParseError);
        expectParseToThrow("redis://", Errors.ParseError);

        expectParseToThrow("redis://host?foo bar=baz qux", Errors.ParseError);
        expectParseToThrow("redis://host?foo\rbar=baz\rqux", Errors.ParseError);
        expectParseToThrow("redis://host?foo\nbar=baz\nqux", Errors.ParseError);
        expectParseToThrow("redis://host?foo\tbar=baz\tqux", Errors.ParseError);
    });

    const expectParseToEqual = (uri: string,
                                expected: BasicOptions.BasicRedisTcpOptions) =>
        Chai.expect(Uri.parseTcp(uri))
            .to.deep.equal(expected);

    const expectParseToThrow = (uri: string, ...rest: Array<any>) =>
        Chai.expect(() => Uri.parseTcp(uri)).to.throw(...rest);
});

Mocha.describe("Celery.Redis.Uri.Socket.parse", () => {
    const PATH: string = "/var/redis.sock";
    const PROTOCOL: string = "redis+socket";
    const SECURE_PROTOCOL: string = "rediss+socket";

    Mocha.it("should parse the usual URIs", () => {
        expectParseToEqual(
            "redis+socket:///var/redis.sock",
            {
                path: PATH,
                protocol: PROTOCOL,
            },
        );

        expectParseToEqual(
            "rediss+socket:///VAR/REDIS.sock",
            {
                path: "/VAR/REDIS.sock",
                protocol: SECURE_PROTOCOL,
            },
        );

        expectParseToEqual(
            "redis+socket:////redis.sock",
            {
                path: "//redis.sock",
                protocol: PROTOCOL,
            }
        );
    });

    Mocha.it("should parse queries", () => {
        expectParseToEqual(
            "redis+socket:///var/redis.sock?noDelay=true",
            {
                noDelay: true,
                path: PATH,
                protocol: PROTOCOL,
            },
        );

        expectParseToEqual(
            "redis+socket:///var/redis.sock?unused=&no_delay=OFF",
            {
                noDelay: false,
                path: PATH,
                protocol: PROTOCOL,
            },
        );

        expectParseToEqual(
            "redis+socket:///var/redis.sock?password=foo",
            {
                password: "foo",
                path: PATH,
                protocol: PROTOCOL,
            },
        );

        expectParseToEqual(
            "redis+socket:///var/redis.sock?password=%2ffoo&noDelay=true",
            {
                noDelay: true,
                password: "/foo",
                path: PATH,
                protocol: PROTOCOL,
            },
        );
    });

    Mocha.it("should not parse invalid URIs", () => {
        expectParseToThrow("redis+socket:///\0/", Errors.ParseError);
        expectParseToThrow("redis+socket:///var/redis.sock?invalid query=key",
                           Errors.ParseError);
        expectParseToThrow("redis+socket:///var/redis.sock?query=invalid key",
                           Errors.ParseError);

        expectParseToThrow("redis://localhost", Errors.ParseError);
        expectParseToThrow("rediss://localhost", Errors.ParseError);
        expectParseToThrow("amqp://localhost", Errors.ParseError);
        expectParseToThrow("amqps://localhost", Errors.ParseError);
    });

    const expectParseToEqual = (
        uri: string,
        expected: BasicOptions.BasicRedisSocketOptions
    ) => Chai.expect(Uri.parseSocket(uri)).to.deep.equal(expected);

    const expectParseToThrow = (uri: string, ...rest: Array<any>) =>
        Chai.expect(() => Uri.parseSocket(uri)).to.throw(...rest);
});
