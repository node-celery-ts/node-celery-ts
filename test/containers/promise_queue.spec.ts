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

import { PromiseQueue } from "../../src/containers";

import * as Chai from "chai";
import * as Mocha from "mocha";

Mocha.describe("Celery.Containers.PromiseQueue", () => {
    Mocha.it("should #resolveOne in FIFO order", async () => {
        const queue = new PromiseQueue<number>();

        const first = queue.push();
        const second = queue.push();

        Chai.expect(queue.resolveOne(0)).to.equal(true);
        Chai.expect(queue.resolveOne(1)).to.equal(true);
        Chai.expect(queue.resolveOne(2)).to.equal(false);

        Chai.expect(await first).to.equal(0);
        Chai.expect(await second).to.equal(1);
    });

    Mocha.it("should #rejectOne in FIFO order", async () => {
        const queue = new PromiseQueue<number>();

        const e1 = new Error("foo");
        const e2 = new Error("bar");

        const first = queue.push();
        const second = queue.push();

        Chai.expect(queue.rejectOne(e1)).to.equal(true);
        Chai.expect(queue.rejectOne(e2)).to.equal(true);
        Chai.expect(queue.rejectOne()).to.equal(false);

        try {
            await first;
            Chai.assert(false);
        } catch (error) {
            if (error instanceof Chai.AssertionError) {
                throw error;
            }

            Chai.expect(error).to.equal(e1);
        }

        try {
            await second;
            Chai.assert(false);
        } catch (error) {
            if (error instanceof Chai.AssertionError) {
                throw error;
            }

            Chai.expect(error).to.equal(e2);
        }
    });

    Mocha.it("should follow Promises in #resolveOne", async () => {
        const queue = new PromiseQueue<number>();

        const e = new Error("foo");

        const first = queue.push();
        const second = queue.push();

        Chai.expect(queue.resolveOne(Promise.resolve(0))).to.equal(true);
        Chai.expect(queue.resolveOne(Promise.reject(e))).to.equal(true);

        Chai.expect(await first).to.equal(0);

        try {
            await second;
            Chai.assert(false);
        } catch (error) {
            if (error instanceof Chai.AssertionError) {
                throw error;
            }

            Chai.expect(error).to.equal(e);
        }
    });

    Mocha.it("should #resolveAll", async () => {
        const queue = new PromiseQueue<number>();

        const first = queue.push();
        const second = queue.push();
        const third = queue.push();

        Chai.expect(queue.resolveAll(0)).to.equal(3);
        Chai.expect(await first).to.equal(0);
        Chai.expect(await second).to.equal(0);
        Chai.expect(await third).to.equal(0);
    });

    Mocha.it("should #resolveAll with an empty queue", () => {
        const queue = new PromiseQueue<number>();

        Chai.expect(queue.resolveAll(0)).to.equal(0);
    });

    Mocha.it("should #rejectAll", async () => {
        const queue = new PromiseQueue<number>();

        const first = queue.push();
        const second = queue.push();
        const third = queue.push();

        const e = new Error("foo");
        Chai.expect(queue.rejectAll(e)).to.equal(3);

        try {
            await first;
            Chai.assert(false);
        } catch (error) {
            if (error instanceof Chai.AssertionError) {
                throw error;
            }

            Chai.expect(error).to.equal(e);
        }

        try {
            await second;
            Chai.assert(false);
        } catch (error) {
            if (error instanceof Chai.AssertionError) {
                throw error;
            }

            Chai.expect(error).to.equal(e);
        }

        try {
            await third;
            Chai.assert(false);
        } catch (error) {
            if (error instanceof Chai.AssertionError) {
                throw error;
            }

            Chai.expect(error).to.equal(e);
        }
    });

    Mocha.it("should #rejectAll with an empty queue", () => {
        const queue = new PromiseQueue<number>();

        Chai.expect(queue.rejectAll(new Error("foo"))).to.equal(0);
    });
});
