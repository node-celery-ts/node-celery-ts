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

import {
    asArray,
    asScalar,
    createBooleanQueryDescriptor,
    createIntegerQueryDescriptor,
    QueryParser,
} from "../src/query_parser";
import { Queries } from "../src/uri";
import { parseBoolean, parseInteger } from "../src/utility";

import * as Chai from "chai";
import * as Mocha from "mocha";

Mocha.describe("Celery.QueryParser.QueryParser", () => {
    interface A {
        foo?: number;
        bar?: boolean;
    }

    const queries: Queries = {
        baz: "10",
        qux: "false",
    };

    Mocha.it("should work", () => {
        const parser = new QueryParser<A>([
            {
                parser: (x) => parseInteger(asScalar(x)),
                source: "baz",
                target: "foo"
            },
            {
                parser: (x) => parseBoolean(asScalar(x)),
                source: "qux",
                target: "bar"
            },
        ]);

        Chai.expect(parser.parse(queries, { })).to.deep.equal({
            bar: false,
            foo: 10,
        });
    });

    Mocha.it("should work with create*QueryDescriptor and co.", () => {
        const parser = new QueryParser<A>([
            createIntegerQueryDescriptor("baz", "foo"),
            createBooleanQueryDescriptor("qux", "bar"),
        ]);

        Chai.expect(parser.parse(queries, { })).to.deep.equal({
            bar: false,
            foo: 10,
        });
    });

    Mocha.it("should default the map target", () => {
        interface B {
            baz?: number;
            qux?: boolean;
        }

        const parser = new QueryParser<B>([
            { parser: (x) => parseInteger(asScalar(x)), source: "baz" },
            { parser: (x) => parseBoolean(asScalar(x)), source: "qux" },
        ]);

        Chai.expect(parser.parse(queries, { })).to.deep.equal({
            baz: 10,
            qux: false,
        });
    });

    Mocha.it("should default to identity mapping", () => {
        interface C {
            foo?: string;
            bar?: string;
        }

        const parser = new QueryParser<C>([
            { source: "baz", target: "foo" },
            { source: "qux", target: "bar" },
        ]);

        Chai.expect(parser.parse(queries, { })).to.deep.equal({
            bar: "false",
            foo: "10",
        });
    });

    Mocha.it("should default target as source and identity mapping", () => {
        interface D {
            baz?: string;
            qux?: string;
        }

        const parser = new QueryParser<D>([
            { source: "baz" },
            { source: "qux" },
        ]);

        Chai.expect(parser.parse(queries, { })).to.deep.equal({
            baz: "10",
            qux: "false",
        });
    });

    Mocha.it("should have no trouble with undefined values", () => {
        const parser = new QueryParser<A>([
            createIntegerQueryDescriptor("baz", "foo"),
            createBooleanQueryDescriptor("qux", "bar"),
        ]);

        Chai.expect(parser.parse({ baz: "10" }, { }))
            .to.deep.equal({ foo: 10 });
    });
});

Mocha.describe("Celery.QueryParser.asScalar", () => {
    Mocha.it("should forward scalars", () => {
        const num = 15;
        const str = "foo";
        const obj = { foo: 10 };

        Chai.expect(asScalar(num)).to.equal(15);
        Chai.expect(asScalar(str)).to.equal("foo");
        Chai.expect(asScalar(obj)).to.equal(obj);
    });

    Mocha.it("should pop off arrays", () => {
        const num = [15];
        const str = ["foo", "bar"];
        const obj = [{ foo: 10 }, { foo: 15 }, { foo: 20 }];

        Chai.expect(asScalar(num)).to.equal(num[0]);
        Chai.expect(asScalar(str)).to.equal(str[1]);
        Chai.expect(asScalar(obj)).to.equal(obj[2]);
    });
});

Mocha.describe("Celery.QueryParser.asArray", () => {
    Mocha.it("should convert scalars", () => {
        const num = 15;
        const str = "foo";
        const obj = { foo: 10 };

        Chai.expect(asArray(num)).to.deep.equal([15]);
        Chai.expect(asArray(str)).to.deep.equal(["foo"]);
        Chai.expect(asArray(obj)).to.deep.equal([obj]);
    });

    Mocha.it("should forward arrays", () => {
        const num = [15];
        const str = ["foo", "bar"];
        const obj = [{ foo: 10 }, { foo: 15 }, { foo: 20 }];

        Chai.expect(asArray(num)).to.equal(num);
        Chai.expect(asArray(str)).to.equal(str);
        Chai.expect(asArray(obj)).to.equal(obj);
    });
});
