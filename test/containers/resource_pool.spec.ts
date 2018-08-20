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

import { ResourcePool } from "../../src/containers";

import * as Chai from "chai";
import * as Mocha from "mocha";

Mocha.describe("Celery.Containers.ResourcePool", () => {
    interface A {
        destroyed: boolean;
        value: number;
    }

    const createPool = () => {
        let value = 0;

        return new ResourcePool<A>(
            () => ({ destroyed: false, value: value++ }),
            (resource) => {
                resource.destroyed = true;
                ++destroyedCount;

                return "destroyed";
            },
            4,
        );
    };

    let destroyedCount = 0;

    Mocha.it("should return resources in FIFO order", () => {
        const count = destroyedCount;
        const pool = createPool();

        return Promise.all([pool.get(), pool.get(), pool.get()]).then(([
            first,
            second,
            third
        ]) => {
            Chai.expect(destroyedCount).to.deep.equal(count);

            pool.return(second);
            pool.return(first);
            pool.return(third);
        }).then(() => Promise.all([pool.get(), pool.get(), pool.get()]))
        .then(([first, second, third]) => {
            Chai.expect(first.value).to.deep.equal(1);
            Chai.expect(second.value).to.deep.equal(0);
            Chai.expect(third.value).to.deep.equal(2);

            pool.return(first);
            pool.return(second);
            pool.return(third);

            return pool.destroyAll()
                .then((returns) => {
                    Chai.expect(returns)
                        .to.deep.equal(["destroyed", "destroyed", "destroyed"]);
                    Chai.expect(destroyedCount).to.deep.equal(count + 3);

                    Chai.expect(first.destroyed).to.deep.equal(true);
                    Chai.expect(second.destroyed).to.deep.equal(true);
                    Chai.expect(third.destroyed).to.deep.equal(true);
                });
        }).catch(() => Chai.expect(false).to.deep.equal(true));
    });

    Mocha.it("should wait to destroy in-use resources", () => {
        const pool = createPool();

        return Promise.all([pool.get(), pool.get(), pool.get()]).then(([
            first,
            second,
            third,
        ]) => {
            const responses = pool.destroyAll();
            let returned = false;

            pool.return(first);

            setImmediate(() => {
                pool.return(second);
                pool.return(third);

                Chai.expect(first.destroyed).to.deep.equal(false);
                Chai.expect(second.destroyed).to.deep.equal(false);
                Chai.expect(third.destroyed).to.deep.equal(false);

                returned = true;
            });

            Chai.expect(returned).to.deep.equal(false);

            Chai.expect(first.destroyed).to.deep.equal(false);
            Chai.expect(second.destroyed).to.deep.equal(false);
            Chai.expect(third.destroyed).to.deep.equal(false);

            return responses.catch(() => Chai.expect(false).to.deep.equal(true))
                .then((returns) => {
                    Chai.expect(returns)
                        .to.deep.equal(["destroyed", "destroyed", "destroyed"]);
                    Chai.expect(returned).to.deep.equal(true);

                    Chai.expect(first.destroyed).to.deep.equal(true);
                    Chai.expect(second.destroyed).to.deep.equal(true);
                    Chai.expect(third.destroyed).to.deep.equal(true);
                });
        });
    });

    Mocha.it("should throw if an unowned resource is returned", () => {
        const pool = createPool();

        const a: A = {
            destroyed: false,
            value: 0,
        };

        Chai.expect(() => pool.return(a)).to.throw(Error);

        return pool.get().then((first) => {
            Chai.expect(() => pool.return(a)).to.throw(Error);
            pool.return(first);

            return pool.destroyAll();
        });
    });

    Mocha.it("should #returnAfter with a Promise that fulfills", () => {
        const pool = createPool();

        const promise = Promise.resolve(5);

        return pool.get()
            .then((a) => {
                Chai.expect(pool.numOwned()).to.deep.equal(1);
                Chai.expect(pool.numInUse()).to.deep.equal(1);
                Chai.expect(pool.numUnused()).to.deep.equal(0);
                Chai.expect(a.value).to.deep.equal(0);

                return pool.returnAfter(promise, a);
            }).then(() => {
                Chai.expect(pool.numOwned()).to.deep.equal(1);
                Chai.expect(pool.numInUse()).to.deep.equal(0);
                Chai.expect(pool.numUnused()).to.deep.equal(1);

                return pool.get();
            }).then((a) => {
                Chai.expect(pool.numOwned()).to.deep.equal(1);
                Chai.expect(pool.numInUse()).to.deep.equal(1);
                Chai.expect(pool.numUnused()).to.deep.equal(0);
                Chai.expect(a.value).to.deep.equal(0);

                return pool.returnAfter(Promise.resolve(), a);
            });
    });

    Mocha.it("should #returnAfter with a Promise that rejects", () => {
        const pool = createPool();

        const error = new Error();
        const promise = Promise.reject(error);

        return pool.get()
            .then((a) => pool.returnAfter(promise, a))
            .catch((e) => {
                Chai.expect(pool.numOwned()).to.deep.equal(1);
                Chai.expect(pool.numInUse()).to.deep.equal(0);
                Chai.expect(pool.numUnused()).to.deep.equal(1);
                Chai.expect(e).to.deep.equal(error);

                return pool.get();
            }).then((a) => {
                Chai.expect(pool.numOwned()).to.deep.equal(1);
                Chai.expect(pool.numInUse()).to.deep.equal(1);
                Chai.expect(pool.numUnused()).to.deep.equal(0);
                Chai.expect(a.value).to.deep.equal(0);

                pool.return(a);
            });
    });

    Mocha.it("should automatically return resources after #use", () => {
        const pool = createPool();

        Chai.expect(pool.numOwned()).to.deep.equal(0);
        Chai.expect(pool.numInUse()).to.deep.equal(0);
        Chai.expect(pool.numUnused()).to.deep.equal(0);

        return pool.use(() => {
            Chai.expect(pool.numOwned()).to.deep.equal(1);
            Chai.expect(pool.numInUse()).to.deep.equal(1);
            Chai.expect(pool.numUnused()).to.deep.equal(0);

            return;
        }).then(() => {
            Chai.expect(pool.numOwned()).to.deep.equal(1);
            Chai.expect(pool.numInUse()).to.deep.equal(0);
            Chai.expect(pool.numUnused()).to.deep.equal(1);
        });
    });

    Mocha.it("should not allocate more resources than are available", () => {
        const pool = createPool();

        const first = pool.get();
        const second = pool.get();
        const third = pool.get();
        const fourth = pool.get();

        return Promise.all([first, second, third, fourth])
            .then((resources: Array<A>) => {
                Chai.expect(pool.numOwned()).to.deep.equal(4);
                Chai.expect(pool.numInUse()).to.deep.equal(4);
                Chai.expect(pool.numUnused()).to.deep.equal(0);

                const fifth = pool.get();
                const sixth = pool.get();

                const doReturn = () => resources.map((r) => pool.return(r));
                setTimeout(doReturn, 5);

                return Promise.all([fifth, sixth]);
            }).then((resources: Array<A>) => {
                Chai.expect(pool.numOwned()).to.deep.equal(4);
                Chai.expect(pool.numInUse()).to.deep.equal(2);
                Chai.expect(pool.numUnused()).to.deep.equal(2);

                Chai.expect(resources[0].value).to.deep.equal(0);
                Chai.expect(resources[1].value).to.deep.equal(1);
            });
    });
});
