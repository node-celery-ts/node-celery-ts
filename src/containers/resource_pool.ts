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
     * @returns The number of resources owned by this pool.
     */
    public numOwned(): number {
        return this.resourceCount;
    }

    /**
     * Resources that are pending are counted here.
     *
     * @returns The number of in-use resources owned by this pool.
     */
    public numInUse(): number {
        return this.resourceCount - this.unused.length;
    }

    /**
     * @returns The number of unused resources owned by this pool.
     */
    public numUnused(): number {
        return this.unused.length;
    }

    /**
     * Gets a resource, invokes `f` with it, then returns it to the pool.
     *
     * @param f A function that accepts a resource and returns some value.
     * @returns A `Promise` that follows the result of invoking `f`.
     */
    public async use<U>(f: (resource: T) => U | PromiseLike<U>): Promise<U> {
        const resource = await this.get();

        try {
            const result = f(resource);

            return this.returnAfter(result, resource);
        } catch (error) {
            return this.returnAfter(Promise.reject(error), resource);
        }
    }

    /**
     * @returns An unused resource from the pool. If none are available, one
     *          will be created.
     */
    public async get(): Promise<T> {
        const resource = await this.getResource();
        this.inUse.add(resource);

        return resource;
    }

    /**
     * @param promise The `Promise` to settle before returning the resource.
     * @param resource The resource to return after `promise` settles.
     */
    public async returnAfter<U>(
        promise: U | PromiseLike<U>,
        resource: T
    ): Promise<U> {
        // unsure why this doesn't work with async/await syntax

        return Promise.resolve(promise)
            .then((value) => {
                this.return(resource);

                return value;
            }).catch((reason) => {
                this.return(resource);

                return Promise.reject(reason);
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
    public async destroyAll(): Promise<Array<string>> {
        if (this.inUse.size !== 0) {
            await promisifyEvent(this.emptyEmitter, "empty");
        }

        const connections = Array.from(this.unused);
        this.unused = new List<T>();

        const replies = connections.map((resource) =>
            this.destroy(resource)
        );

        return Promise.all(replies);
    }

    /**
     * @returns A resource. Will be created if all owned resources are in use.
     */
    private async getResource(): Promise<T> {
        const maybeUnused = this.unused.shift();

        if (typeof maybeUnused !== "undefined") {
            return maybeUnused;
        } else if (this.resourceCount < this.maxResources) {
            ++this.resourceCount;

            return Promise.resolve(this.create());
        }

        return new Promise<T>((resolve, reject) => {
            this.waiting.push({ reject, resolve });
        });
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
