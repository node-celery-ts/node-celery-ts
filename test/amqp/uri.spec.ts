// BSD 3-Clause License
//
// Copyright (c) 2018, IBM Corporation
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

import * as Options from "../../src/amqp/options";
import * as Uri from "../../src/amqp/uri";

import * as Chai from "chai";
import * as Mocha from "mocha";

/* tslint:disable:no-hardcoded-credentials no-big-function */

Mocha.describe("Celery.Amqp.Uri.parse", () => {
    Mocha.it("should parse basic URIs", () => {
        assertParse(
            "amqp://localhost",
            {
                hostname: "localhost",
                protocol: "amqp",
            },
         );

        assertParse(
            "amqp://user:pass@host:42/vhost",
            {
                hostname: "host",
                password: "pass",
                port: 42,
                protocol: "amqp",
                username: "user",
                vhost: "vhost",
            },
        );

        assertParse(
            "amqps://localhost",
            {
                hostname: "localhost",
                protocol: "amqps",
            },
         );

        assertParse(
            "amqps://user:pass@host:42/vhost",
            {
                hostname: "host",
                password: "pass",
                port: 42,
                protocol: "amqps",
                username: "user",
                vhost: "vhost",
            },
        );
    });

    Mocha.it("should parse sparse URIs", () => {
        assertParse(
            "amqp://:@h/",
            {
                hostname: "h",
                protocol: "amqp",
                vhost: "",
            },
        );

        assertParse(
            "amqp://username:@h/",
            {
                hostname: "h",
                protocol: "amqp",
                username: "username",
                vhost: "",
            },
        );

        assertParse(
            "amqp://:password@h/",
            {
                hostname: "h",
                password: "password",
                protocol: "amqp",
                username: "",
                vhost: "",
            },
        );

        assertParse(
            "amqp://:@h/vhost",
            {
                hostname: "h",
                protocol: "amqp",
                vhost: "vhost",
            },
        );
    });

    Mocha.it("should parse valid hostnames", () => {
        assertParse(
            "amqp://h.name",
            {
                hostname: "h.name",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://host-n",
            {
                hostname: "host-n",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://h.n",
            {
                hostname: "h.n",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://thisuriislongbutwecanstillmatchagainstitbecauseithas63orles"
            + "scha.thisuriislongbutwecanstillmatchagainstitbecauseithas63orles"
            + "scha",
            {
                hostname: "thisuriislongbutwecanstillmatchagainstitbecauseithas"
                          + "63orlesscha.thisuriislongbutwecanstillmatchagainst"
                          + "itbecauseithas63orlesscha",
                protocol: "amqp",
            },
        );

        assertParse(
            "amqp://0",
            {
                hostname: "0",
                protocol: "amqp",
            },
        );

        assertParse(
            "amqp://00",
            {
                hostname: "00",
                protocol: "amqp",
            },
        );
    });

    Mocha.it("should not parse invalid hostnames", () => {
        assertParseThrows("amqp://"); // uris do not have empty hostnames

        assertParseThrows("amqp://-");
        assertParseThrows("amqp://f-");
        assertParseThrows("amqp://-f");
        assertParseThrows("amqp://-f-");

        assertParseThrows("amqp://.");
        assertParseThrows("amqp://f.");
        assertParseThrows("amqp://.f");
        assertParseThrows("amqp://.f.");

        assertParseThrows("amqp://thisuriistoolongbecauseithas64charactersandi"
                          + "wontcutmyselfoffagai.thisuriislongbutwecanstill"
                          + "matchagainstitbecauseithas63orlesscha");
        assertParseThrows("amqp://thisuriislongbutwecanstillmatchagainstit"
                          + "becauseithas63orlesscha.thisuriistoolongbecauseit"
                          + "has64charactersandiwontcutmyselfoffagai");

        assertParseThrows("amqp://ß"); // no UTF for hostnames :(

        assertParseThrows("amqp://host?foo bar=baz qux");
        assertParseThrows("amqp://host?foo\rbar=baz\rqux");
        assertParseThrows("amqp://host?foo\nbar=baz\nqux");
        assertParseThrows("amqp://host?foo\tbar=baz\tqux");

        const RESERVED: Array<string> = ["!", "*", "'", "(", ")", ";", ":",
                                         "@", "&", "=", "+", "$", ",", "/",
                                         "?", "#", "[", "]"];

        for (const c of RESERVED) {
            assertParseThrows(`amqp://${c}`);
        }
    });

    Mocha.it("should parse queries in snake_case and camelCase", () => {
        assertParse(
            "amqp://h?channelMax=5555",
            {
                channelMax: 5555,
                hostname: "h",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://h?channel_max=0x2a",
            {
                channelMax: 0x2A,
                hostname: "h",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://h?frameMax=0x1000",
            {
                frameMax: 0x1000,
                hostname: "h",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://h?frame_max=4096",
            {
                frameMax: 4096,
                hostname: "h",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://h?heartbeat=5",
            {
                heartbeat: 5,
                hostname: "h",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://h?heartbeat=0x0",
            {
                heartbeat: 0x0,
                hostname: "h",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://h?locale=en_UK",
            {
                hostname: "h",
                locale: "en_UK",
                protocol: "amqp",
            }
         );

        assertParse(
            "amqp://h?locale=en_US&heartbeat=13&frame_max=0x1000&channelMax=15",
            {
                channelMax: 15,
                frameMax: 0x1000,
                heartbeat: 13,
                hostname: "h",
                locale: "en_US",
                protocol: "amqp",
            }
        );

        assertParse(
            "amqp://localhost?unused=&frameMax=0b111",
            {
                frameMax: 7,
                hostname: "localhost",
                protocol: "amqp",
            }
        );
    });

    Mocha.it("should not parse ill-formed queries", () => {
        assertParseThrows("amqp://?");
        assertParseThrows("amqp://?=");
        assertParseThrows("amqp://?&=");
        assertParseThrows("amqp://?key=value&");
        assertParseThrows("amqp://?&");
        assertParseThrows("amqp://?/");
        assertParseThrows("amqp://?key=");
        assertParseThrows("amqp://?=value");
        assertParseThrows("amqp://?key=value&key=");
        assertParseThrows("amqp://?key=value&=value");
        assertParseThrows("amqp://?key=value&=");
    });

    Mocha.it("should not parse URIs with non-AMQP schemes", () => {
        assertParseThrows("redis://localhost");
        assertParseThrows("rediss://localhost");
    });

    const assertParse = (uri: string, expected: Options.AmqpOptions) =>
        Chai.expect(Uri.parseAmqpUri(uri))
            .to.deep.equal(expected);

    const assertParseThrows = (uri: string) =>
        Chai.expect(() => Uri.parseAmqpUri(uri)).to.throw(Error);
});
