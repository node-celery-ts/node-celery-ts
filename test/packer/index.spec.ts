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
    Compressor,
    createDefaultPacker,
    createPacker,
    Encoder,
    Packer,
    Serializer,
} from "../../src/packer";

import * as Chai from "chai";
import * as Mocha from "mocha";

Mocha.describe("Celery.Packer.Packer", () => {
    const data = {
        arr: [0, 5, 10],
        num: 15,
        obj: {
            bar: 10,
            foo: 5,
        },
        str: "foo",
    };

    const concatenate = (strings: Array<string>): string =>
        strings.map((s) => `${s}\n`).reduce((lhs, rhs) => lhs + rhs);

    Mocha.it("should be created by default with JSON/Base64", () => {
        // tslint:disable:max-line-length
        const expected = "eyJhcnIiOlswLDUsMTBdLCJudW0iOjE1LCJvYmoiOnsiYmFyIjoxMCwiZm9vIjo1fSwic3RyIjoiZm9vIn0=";

        const packer: Packer = createDefaultPacker();

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });

    Mocha.it("should work as expected with JSON", () => {
        // tslint:disable:max-line-length
        const expected = "{\"arr\":[0,5,10],\"num\":15,\"obj\":{\"bar\":10,\"foo\":5},\"str\":\"foo\"}";

        const packer: Packer = createPacker({
            compressor: Compressor.Identity,
            encoder: Encoder.Plaintext,
            serializer: Serializer.Json,
        });

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });

    Mocha.it("should work as expected with YAML", () => {
        const expected = concatenate([
            "arr:",
            "  - 0",
            "  - 5",
            "  - 10",
            "num: 15",
            "obj:",
            "  bar: 10",
            "  foo: 5",
            "str: foo",
        ]);

        const packer: Packer = createPacker({
            compressor: Compressor.Identity,
            encoder: Encoder.Plaintext,
            serializer: Serializer.Yaml,
        });

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });

    Mocha.it("should work as expected with JSON/Base64", () => {
        // tslint:disable:max-line-length
        const expected = "eyJhcnIiOlswLDUsMTBdLCJudW0iOjE1LCJvYmoiOnsiYmFyIjoxMCwiZm9vIjo1fSwic3RyIjoiZm9vIn0=";

        const packer: Packer = createPacker({
            compressor: Compressor.Identity,
            encoder: Encoder.Base64,
            serializer: Serializer.Json,
        });

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });

    Mocha.it("should work as expected with YAML/Base64", () => {
        // tslint:disable:max-line-length
        const expected = "YXJyOgogIC0gMAogIC0gNQogIC0gMTAKbnVtOiAxNQpvYmo6CiAgYmFyOiAxMAogIGZvbzogNQpzdHI6IGZvbwo=";

        const packer: Packer = createPacker({
            compressor: Compressor.Identity,
            encoder: Encoder.Base64,
            serializer: Serializer.Yaml,
        });

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });

    Mocha.it("should work as expected with JSON/zlib", () => {
        // tslint:disable:max-line-length
        const expected = "eJyrVkosKlKyijbQMdUxNIjVUcorzVWyMjTVUcpPylKyqlZKSgRKGxroKKXl5ytZmdbqKBWXAEXA3FoAHCMRkQ==";

        const packer: Packer = createPacker({
            compressor: Compressor.Zlib,
            encoder: Encoder.Base64,
            serializer: Serializer.Json,
        });

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });

    Mocha.it("should work as expected with JSON/gzip", () => {
        // tslint:disable:max-line-length
        const expected = "H4sIAAAAAAAAE6tWSiwqUrKKNtAx1TE0iNVRyivNVbIyNNVRyk/KUrKqVkpKBEobGugopeXnK1mZ1uooFZcARcDcWgB6hKEdPgAAAA==";

        const packer: Packer = createPacker({
            compressor: Compressor.Gzip,
            encoder: Encoder.Base64,
            serializer: Serializer.Json,
        });

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });

    Mocha.it("should work as expected with YAML/zlib", () => {
        // tslint:disable:max-line-length
        const expected = "eJxLLCqy4lJQ0FUwAJOmYNLQgCuvNNdKwdCUKz8pCySflFhkBRJWUEjLz7cCKisuAQoA2VwAyKIPBg==";

        const packer: Packer = createPacker({
            compressor: Compressor.Zlib,
            encoder: Encoder.Base64,
            serializer: Serializer.Yaml,
        });

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });

    Mocha.it("should work as expected with YAML/gzip", () => {
        // tslint:disable:max-line-length
        const expected = "H4sIAAAAAAAAE0ssKrLiUlDQVTAAk6Zg0tCAK68010rB0JQrPykLJJ+UWGQFElZQSMvPtwIqKy4BCgDZXACqR7x7QQAAAA==";

        const packer: Packer = createPacker({
            compressor: Compressor.Gzip,
            encoder: Encoder.Base64,
            serializer: Serializer.Yaml,
        });

        const packed = packer.pack(data);
        const unpacked = packer.unpack(packed);

        Chai.expect(packed).to.deep.equal(expected);
        Chai.expect(unpacked).to.deep.equal(data);
    });
});
