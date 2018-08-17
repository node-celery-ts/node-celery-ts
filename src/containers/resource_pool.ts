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

import { List } from "./list";

import { isNullOrUndefined, promisifyEvent } from "../utility";

import * as Events from "events";

/**
 * Represents a generic resource pool. If no resources are available, will
 * create and register a new one. Uses a doubly-linked list as a FIFO queue for
 * unused resources and a Set for in-use resources.
 */
export class ResourcePool<T> {
    private readonly create: () => T | PromiseLike<T>;
    private readonly destroy: (resource: T) => string | PromiseLike<string>;
    private readonly emptyEmitter: Events.EventEmitter;
    private inUse: Set<T>;
    private readonly maxResources: number;
    private unused: List<T>;
    private resourceCount: number = 0;
    private waiting: List<PromiseFunctions<T>>;

    /**
     * @param create Function to be called when a new resource must be created.
     * @param destroy Function to be called when a resource must be destroyed.
     * @returns An empty ResourcePool.
     */
    public constructor(
        create: () => T | PromiseLike<T>,
        destroy: (resource: T) => string | PromiseLike<string>,
        maxResources: number,
    ) {
        this.create = create;
        this.destroy = destroy;
        this.maxResources = maxResources;

        this.emptyEmitter = new Events.EventEmitter();

        this.inUse = new Set<T>();
        this.unused = new List<T>();
        this.waiting = new List<PromiseFunctions<T>>();
    }

    /**
     * Gets a resource, invokes `f` with it, then returns it to the pool.
     *
     * @param f A function that accepts a resource and returns some value.
     * @returns A `Promise` that follows the result of invoking `f`.
     */
    public use<U>(f: (resource: T) => U | PromiseLike<U>): Promise<U> {
        return this.get()
            .then((resource) => this.returnAfter(f(resource), resource));
    }

    /**
     * @returns An unused resource from the pool. If none are available, one
     *          will be created.
     */
    public get(): Promise<T> {
        const resource = this.getResource();

        return resource.then((r) => {
            this.inUse.add(r);

            return r;
        });
    }

    /**
     * @param promise The `Promise` to settle before returning the resource.
     * @param resource The resource to return after `promise` settles.
     */
    public returnAfter<U>(
        promise: U | PromiseLike<U>,
        resource: T
    ): Promise<U> {
        return Promise.resolve(promise).catch((reason) => {
            this.return(resource);

            return Promise.reject(reason);
        }).then((value) => {
            this.return(resource);

            return value;
        });
    }

    /**
     * @param resource The resource to return to the pool.
     * @throws Error If the resource does not belong to this pool.
     */
    public return(resource: T): void {
        if (!this.inUse.delete(resource)) {
            throw new Error("resource does not belong to this pool");
        }

        const maybeWaiting = this.waiting.shift();

        if (!isNullOrUndefined(maybeWaiting)) {
            const waiting = maybeWaiting;
            waiting.resolve(resource);

            return;
        }

        if (this.inUse.size === 0) {
            this.emptyEmitter.emit("empty");
        }

        this.unused.push(resource);
    }

    /**
     * @returns A Promise that resolves to the response of each call to
     *          destroy() after all resources have been returned.
     */
    public destroyAll(): Promise<Array<string>> {
        const doDestroy = () => {
            const connections = Array.from(this.unused);
            this.unused = new List<T>();

            const replies = connections.map((resource) =>
                this.destroy(resource)
            );

            return Promise.all(replies);
        };

        if (this.inUse.size !== 0) {
            return promisifyEvent(this.emptyEmitter, "empty").then(doDestroy);
        }

        return doDestroy();
    }

    /**
     * @returns A resource. Will be created if all owned resources are in use.
     */
    private getResource(): Promise<T> {
        if (this.unused.length === 0) {
            if (this.resourceCount < this.maxResources) {
                ++this.resourceCount;

                return Promise.resolve(this.create());
            } else {
                const promise = new Promise<T>((resolve, reject) => {
                    this.waiting.push({ reject, resolve });
                });

                return promise;
            }
        }

        return Promise.resolve(this.unused.shift()!);
    }
}

/**
 * Functions that can be used to settle a `Promise`. Should be taken from
 * the `[resolve, reject]` function invoked by the constructor of `Promise`.
 */
interface PromiseFunctions<T> {
    reject(reason?: any): void;
    resolve(value: T | PromiseLike<T>): void;
}
