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

import * as Errors from "../src/errors";
import * as Utility from "../src/utility";

import * as Events from "events";

import * as Chai from "chai";
import * as Mocha from "mocha";

Mocha.describe("Celery.Utility.parseInteger", () => {
    Mocha.it("should parse base-2, 8, 10, and 16 literals", () => {
        Chai.expect(Utility.parseInteger("1")).to.deep.equal(1);
        Chai.expect(Utility.parseInteger("15")).to.deep.equal(15);
        Chai.expect(Utility.parseInteger("8")).to.deep.equal(8);

        Chai.expect(Utility.parseInteger("0")).to.deep.equal(0);
        Chai.expect(Utility.parseInteger("0666")).to.deep.equal(438);
        Chai.expect(Utility.parseInteger("010")).to.deep.equal(8);

        Chai.expect(Utility.parseInteger("0xdeadBEEF"))
            .to.deep.equal(3735928559);
        Chai.expect(Utility.parseInteger("0X5")).to.deep.equal(5);
        Chai.expect(Utility.parseInteger("0x01ab")).to.deep.equal(427);

        Chai.expect(Utility.parseInteger("0b1111")).to.deep.equal(15);
        Chai.expect(Utility.parseInteger("0B0101")).to.deep.equal(5);
        Chai.expect(Utility.parseInteger("0B0")).to.deep.equal(0);
    });

    Mocha.it("should trim whitespace from literals", () => {
        Chai.expect(Utility.parseInteger(" 42")).to.deep.equal(42);
        Chai.expect(Utility.parseInteger("42\t")).to.deep.equal(42);
        Chai.expect(Utility.parseInteger("\t42\n")).to.deep.equal(42);
    });

    Mocha.it("should not parse ill formed literals", () => {
        Chai.expect(() => Utility.parseInteger("0x"))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseInteger("0xg"))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseInteger("0XG"))
            .to.throw(Errors.ParseError);

        Chai.expect(() => Utility.parseInteger("08"))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseInteger("09"))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseInteger("0a"))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseInteger("0f"))
            .to.throw(Errors.ParseError);

        Chai.expect(() => Utility.parseInteger("0b2"))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseInteger("0b9"))
            .to.throw(Errors.ParseError);

        Chai.expect(() => Utility.parseInteger("a"))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseInteger("f"))
            .to.throw(Errors.ParseError);

        Chai.expect(() => Utility.parseInteger("foo"))
            .to.throw(Errors.ParseError);
    });
});

Mocha.describe("Celery.Utility.parseBoolean", () => {
    Mocha.it("should parse expected strings as booleans", () => {
        Chai.expect(Utility.parseBoolean("true")).to.deep.equal(true);
        Chai.expect(Utility.parseBoolean("on")).to.deep.equal(true);
        Chai.expect(Utility.parseBoolean("yes")).to.deep.equal(true);
        Chai.expect(Utility.parseBoolean("1")).to.deep.equal(true);

        Chai.expect(Utility.parseBoolean("false")).to.deep.equal(false);
        Chai.expect(Utility.parseBoolean("off")).to.deep.equal(false);
        Chai.expect(Utility.parseBoolean("no")).to.deep.equal(false);
        Chai.expect(Utility.parseBoolean("0")).to.deep.equal(false);
    });

    Mocha.it("should not parse invalid inputs", () => {
        Chai.expect(() => Utility.parseBoolean(""))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseBoolean("foo"))
            .to.throw(Errors.ParseError);
        Chai.expect(() => Utility.parseBoolean("2"))
            .to.throw(Errors.ParseError);
    });
});

Mocha.describe("Celery.Utility.isNullOrUndefined", () => {
    Mocha.it("should return true if the value is null", () => {
        Chai.expect(Utility.isNullOrUndefined(null)).to.deep.equal(true);
    });

    Mocha.it("should return true if the value is undefined", () => {
        Chai.expect(Utility.isNullOrUndefined(undefined)).to.deep.equal(true);
    });

    Mocha.it("should return false if the value is truthy", () => {
        Chai.expect(Utility.isNullOrUndefined(1)).to.deep.equal(false);
        Chai.expect(Utility.isNullOrUndefined("a")).to.deep.equal(false);
        Chai.expect(Utility.isNullOrUndefined(true)).to.deep.equal(false);
        Chai.expect(Utility.isNullOrUndefined([])).to.deep.equal(false);
        Chai.expect(Utility.isNullOrUndefined({ })).to.deep.equal(false);
    });

    Mocha.it("should return false if the value is falsy but not null", () => {
        Chai.expect(Utility.isNullOrUndefined(0)).to.deep.equal(false);
        Chai.expect(Utility.isNullOrUndefined("")).to.deep.equal(false);
        Chai.expect(Utility.isNullOrUndefined(NaN)).to.deep.equal(false);
        Chai.expect(Utility.isNullOrUndefined(false)).to.deep.equal(false);
    });
});

Mocha.describe("Celery.Utility.toCamelCase", () => {
    Mocha.it("should convert snake_case to camelCase", () => {
        Chai.expect(Utility.toCamelCase("foo_bar"))
            .to.deep.equal("fooBar");
    });

    Mocha.it("should not modify camelCase statements", () => {
        Chai.expect(Utility.toCamelCase("fooBar"))
            .to.deep.equal("fooBar");
    });
});

Mocha.describe("Celery.Utility.promisifyEvent", () => {
    Mocha.it("should only resolve when the event is emitted", () => {
        const emitter = new Events.EventEmitter();
        let emitted = false;

        const event = Utility.promisifyEvent<void>(emitter, "foo");

        setImmediate(() => {
            emitter.emit("foo");
            emitted = true;
        });

        return event.then(() => {
            Chai.expect(emitted).to.deep.equal(true);
        });
    });

    Mocha.it("should transmit the argument passed", () => {
        const emitter = new Events.EventEmitter();
        let emitted = false;

        const event = Utility.promisifyEvent(emitter, "foo");

        setImmediate(() => {
            emitter.emit("foo", 42);
            emitted = true;
        });

        return event.then((value) => {
            Chai.expect(value).to.deep.equal(42);
            Chai.expect(emitted).to.deep.equal(true);
        });
    });

    Mocha.it("should not resolve on other events being emitted", () => {
        const emitter = new Events.EventEmitter();
        let emitted = false;

        const event = Utility.promisifyEvent(emitter, "foo");

        setTimeout(() => emitter.emit("bar"), 5);
        setTimeout(
            () => {
                emitter.emit("foo");
                emitted = true;
            },
            10
        );

        return event.then(() => {
            Chai.expect(emitted).to.deep.equal(true);
        });
    });

    Mocha.it("should work with Symbol values", () => {
        const emitter = new Events.EventEmitter();
        const symbol = Symbol("foo");

        const event = Utility.promisifyEvent(emitter, symbol);

        setImmediate(() => {
            emitter.emit(symbol);
        });

        return event;
    });
});

Mocha.describe("Celery.Utility.filterMapEvent", () => {
    Mocha.it("should only resolve when the filter is true", () => {
        const emitter = new Events.EventEmitter();
        let shouldResolve = false;

        const event = Utility.filterMapEvent({
            emitter,
            filterMap(value: number): number | undefined {
                if (shouldResolve) {
                    return value * 2;
                }

                return undefined;
            },
            name: "foo",
        });

        setTimeout(() => {
            emitter.emit("foo", 3);
        }, 5);

        setTimeout(() => {
            shouldResolve = true;
            emitter.emit("foo", 15);
        }, 10);

        return event.then((value) => {
            Chai.expect(value).to.deep.equal(30);
        });
    });
});

Mocha.describe("Celery.Utility.createTimeoutPromise", () => {
    Mocha.it("should resolve if the input resolves", () => {
        const promise = Promise.resolve(5);

        return Utility.createTimeoutPromise(promise, 5)
            .then((value) => Chai.expect(value).to.deep.equal(5));
    });

    Mocha.it("should reject upon a timeout", () => {
        const promise = new Promise((resolve) => setTimeout(resolve, 10));

        return Utility.createTimeoutPromise(promise, 5)
            .then(() => Chai.expect(false).to.equal(true))
            .catch(() => { });
    });

    Mocha.it("should resolve before the timeout", () => {
        const promise = new Promise((resolve) => setTimeout(resolve, 5));

        return Utility.createTimeoutPromise(promise, 10);
    });

    Mocha.it("should reject if the other promise will reject", () =>
        Utility.createTimeoutPromise(Promise.reject(5), 5)
            .catch((reason) => Chai.expect(reason).to.deep.equal(5))
    );

    Mocha.it("should follow the promise if the timeout is undefined", () =>
        Utility.createTimeoutPromise(Promise.resolve(5))
            .catch((value) => Chai.expect(value).to.deep.equal(5))
    );
});

Mocha.describe("Celery.Utility.createTimerPromise", () => {
    Mocha.it("should reject in the given time", () => {
        let firstResolved = false;
        let secondResolved = false;

        setTimeout(() => { firstResolved = true; }, 5);
        setTimeout(() => { secondResolved = true; }, 15);

        return Utility.createTimerPromise(10).then(() => {
            Chai.expect(true).to.deep.equal(false);
        }).catch(() => {
            Chai.expect(firstResolved).to.deep.equal(true);
            Chai.expect(secondResolved).to.deep.equal(false);
        });
    });
});
