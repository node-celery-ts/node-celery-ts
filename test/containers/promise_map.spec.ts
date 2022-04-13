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

import { PromiseMap } from "../../src/containers";

import * as Chai from "chai";
import * as Mocha from "mocha";

Mocha.describe("Celery.Containers.PromiseMap", () => {
    Mocha.it("should register promises when getting them", () => {
        const map = new PromiseMap<string, { data: number }>();

        const value = { data: 15 };
        const num = map.get("foo");
        Chai.expect(map.has("foo")).to.equal(true);
        Chai.expect(map.isPending("foo")).to.equal(true);
        Chai.expect(map.resolve("foo", value)).to.equal(false);

        return num.then((v) => {
            Chai.expect(map.isFulfilled("foo")).to.equal(true);
            Chai.expect(v).to.equal(value);
        });
    });

    Mocha.it("should register promises when settling them", () => {
        const map = new PromiseMap<string, { data: number }>();

        const value = { data: 10 };
        Chai.expect(map.resolve("foo", value)).to.equal(true);
        Chai.expect(map.has("foo")).to.equal(true);
        Chai.expect(map.isPending("foo")).to.equal(true);
        const num = map.get("foo");

        return num.then((v) => {
            Chai.expect(map.isFulfilled("foo")).to.equal(true);
            Chai.expect(v).to.equal(value);
        });
    });

    Mocha.it("should properly reject unregistered promises", () => {
        const map = new PromiseMap<string, void>();

        const error = new Error("error");

        Chai.expect(map.reject("foo", error)).to.equal(true);
        Chai.expect(map.has("foo")).to.equal(true);
        Chai.expect(map.isRejected("foo")).to.equal(true);
        const num = map.get("foo");

        return num.catch((reason) => {
            Chai.expect(map.isRejected("foo")).to.equal(true);
            Chai.expect(reason).to.equal(error);
        });
    });

    Mocha.it("should reject registered promises", () => {
        const map = new PromiseMap<string, void>();

        const error = new Error("error");

        const num = map.get("foo");
        Chai.expect(map.reject("foo", error)).to.equal(false);
        Chai.expect(map.has("foo")).to.equal(true);
        Chai.expect(map.isRejected("foo")).to.equal(true);

        return num.catch((reason) => {
            Chai.expect(map.isRejected("foo")).to.equal(true);
            Chai.expect(reason).to.equal(error);
        });
    });

    Mocha.it("should overwrite settled Promises with #resolve", async () => {
        const map =  new PromiseMap<string, number>();
        map.resolve("foo", 5);

        Chai.expect(await map.get("foo")).to.equal(5);

        map.resolve("foo", 10);

        Chai.expect(await map.get("foo")).to.equal(10);
    });

    Mocha.it("should overwrite settled Promises with #reject", async () => {
        const map =  new PromiseMap<string, number>();
        map.resolve("foo", 5);

        const error = new Error("foo");
        map.reject("foo", error);

        try {
            await map.get("foo");
            Chai.assert(false);
        } catch (e) {
            Chai.expect(e).to.equal(error);
        }
    });

    Mocha.it("should delete promises as expected", () => {
        const map =  new PromiseMap<string, number>();
        const value = map.get("foo");

        Chai.expect(map.delete("foo")).to.equal(true);
        Chai.expect(map.delete("foo")).to.equal(false);

        Chai.expect(map.has("foo")).to.equal(false);

        return value.catch(() => Chai.expect(true).to.equal(true));
    });

    Mocha.it("should not reject settled promises in rejectAll", () => {
        const map =  new PromiseMap<string, number>();
        map.resolve("foo", 15);

        const error = new Error("rejected");

        const value = map.get("bar");
        map.rejectAll(error);

        return value.catch((e) => {
            Chai.expect(e).to.equal(error);
            Chai.expect(map.has("bar")).to.equal(true);

            return map.get("foo");
        }).then((foo) => {
            Chai.expect(foo).to.equal(15);
            Chai.expect(map.has("foo")).to.equal(true);
        });
    });

    Mocha.it("should delete registered promises with clear", () => {
        const map = new PromiseMap<string, number>();
        map.resolve("foo", 10);
        map.resolve("bar", 5);

        map.clear();

        map.resolve("baz", 25);

        Chai.expect(map.delete("foo")).to.equal(false);
        Chai.expect(map.delete("bar")).to.equal(false);
        Chai.expect(map.delete("baz")).to.equal(true);
    });

    Mocha.it("should reject pending promises with #clear", async () => {
        const map = new PromiseMap<string, number>();
        map.resolve("foo", 0);
        const bar = map.get("bar");

        map.clear();

        Chai.expect(map.has("foo")).to.equal(false);
        Chai.expect(map.has("bar")).to.equal(false);

        try {
            await bar;
            Chai.assert(false);
        } catch (error: any) {
            Chai.expect(error.message).to.equal("cleared");
        }
    });

    Mocha.it("should handle timeouts as expected", () => {
        const map = new PromiseMap<string, number>(10);

        const request = map.get("foo");

        return new Promise((resolve) => {
            setTimeout(resolve, 5);
        }).then(() => {
            map.resolve("foo", 5);

            return request;
        }).then((value) => {
            Chai.expect(value).to.equal(5);

            return new Promise((resolve) => {
                setTimeout(resolve, 15);
            });
        }).then(() => {
            Chai.expect(map.has("foo")).to.equal(false);
        });
    });

    Mocha.it("should reject rejecting promises", () => {
        const map = new PromiseMap<string, number>();

        const error = new Error("bar");

        map.resolve("foo", Promise.reject(error));
        Chai.expect(map.has("foo")).to.equal(true);
        Chai.expect(map.isPending("foo")).to.equal(true);

        return map.get("foo").catch((reason) => {
            Chai.expect(map.isRejected("foo")).to.equal(true);
            Chai.expect(reason).to.equal(error);
        });
    });

    Mocha.it("should reject rejecting promises that have been created", () => {
        const map = new PromiseMap<string, number>();

        const value = map.get("foo");

        Chai.expect(map.has("foo")).to.equal(true);
        Chai.expect(map.isPending("foo")).to.equal(true);

        const error = new Error("bar");
        map.resolve("foo", Promise.reject(error));

        Chai.expect(map.has("foo")).to.equal(true);
        Chai.expect(map.isPending("foo")).to.equal(true);

        return value.then(() => {
            Chai.expect(false);
        }).catch((reason) => {
            Chai.expect(map.isRejected("foo")).to.equal(true);
            Chai.expect(reason).to.equal(error);
        });
    });
});
