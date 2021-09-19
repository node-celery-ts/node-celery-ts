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

import { PromiseFunctions } from "../promise_functions";
import { isUndefined } from "../utility";

/**
 * `PromiseMap` is a key-value store where the values are `Promise`s.
 * It allows for inspection of the state of owned `Promise`s - whether pending,
 * fulfilled, or rejected - as well as the ability to resolve or reject owned
 * `Promise`s that are pending.
 */
export class PromiseMap<K, V> {
    private promises: Map<K, Promise<V>>;
    private data: Map<K, MapData<V>>;
    private readonly timeout?: number;

    /**
     * @param timeout The duration, in milliseconds, to wait before deleting
     *                settled `Promise`s.
     * @returns An empty `PromiseMap`.
     */
    public constructor(timeout?: number) {
        this.promises = new Map<K, Promise<V>>();
        this.data = new Map<K, MapData<V>>();
        this.timeout = timeout;
    }

    /**
     * @param key The key to check for membership in the owned set.
     * @returns True if this contains the requested key.
     */
    public has(key: K): boolean {
        return this.promises.has(key);
    }

    /**
     * @param key The key of the Promise whose status is to be queried.
     * @returns True if the key is in the owned set and the matching `Promise`
     *          is pending.
     */
    public isPending(key: K): boolean {
        const entry = this.data.get(key);

        return !isUndefined(entry) && entry.status === State.Pending;
    }

    /**
     * @param key The key of the Promise whose status is to be queried.
     * @returns True if the key is in the owned set and the matching `Promise`
     *          is fulfilled.
     */
    public isFulfilled(key: K): boolean {
        const entry = this.data.get(key);

        return !isUndefined(entry) && entry.status === State.Fulfilled;
    }

    /**
     * @param key The key of the `Promise` whose status is to be queried.
     * @returns True if the key is in the owned set and the matching `Promise`
     *          is rejected.
     */
    public isRejected(key: K): boolean {
        const entry = this.data.get(key);

        return !isUndefined(entry) && entry.status === State.Rejected;
    }

    /**
     * The matching `Promise` to `key` will remain pending until `value`
     * resolves. If `value` is a `Promise`-like type, the corresponding
     * `Promise` will follow `value`. If not, the owned `Promise` will be
     * fulfilled.
     *
     * @param key The key of the `Promise` to be settled. Must be pending or
     *            not in the owned set.
     * @param value The value to settle the `Promise` to.
     * @returns True if a new `Promise` was inserted.
     */
    public resolve(key: K, value: V | PromiseLike<V>): boolean {
        return this.settle({
            key,
            onExisting: (data) => this.resolveExisting({ key, data, value }),
            onNew: () => this.resolveNew(key, value),
        });
    }

    /**
     * @param key The key of the `Promise` to be rejected. Must be pending or
     *            not in the owned set.
     * @param reason The reason to reject the `Promise` with.
     * @returns True if a new `Promise` was inserted.
     */
    public reject(key: K, reason?: any): boolean {
        return this.settle({
            key,
            onExisting: (data) => this.rejectExisting({ key, data, reason }),
            onNew: () => this.rejectNew(reason),
        });
    }

    /**
     * Rejects all pending `Promise`s that are not following another `Promise`.
     *
     * @param reason The reason to reject any pending `Promise`s with.
     * @returns The number of rejected `Promise`s.
     */
    public rejectAll(reason?: any): number {
        let numRejected = 0;

        for (const [key, data] of this.data.entries()) {
            if (data.status !== State.Pending || isUndefined(data.functions)) {
                continue;
            }

            this.reject(key, reason);
            ++numRejected;
        }

        return numRejected;
    }

    /**
     * If `key` is not in the owned set, a new `Promise` will be created.
     *
     * @param key The key of the `Promise` to get.
     * @returns The matching `Promise` to the key.
     */
    public async get(key: K): Promise<V> {
        const maybePromise = this.promises.get(key);

        if (!isUndefined(maybePromise)) {
            return maybePromise;
        }

        const promise = new Promise<V>((resolve, reject) => this.data.set(key, {
            functions: { resolve, reject },
            status: State.Pending,
        }));

        this.promises.set(key, promise);

        return promise;
    }

    /**
     * @param key The key of the `Promise` to delete.
     * @returns True if `key` and the matching `Promise` were in the owned set.
     */
    public delete(key: K): boolean {
        return this.doDelete(key, new Error("deleted"));
    }

    /**
     * @returns The number of `Promise`s that were deleted.
     */
    public clear(): number {
        const error = new Error("cleared");

        for (const controlBlock of this.data.values()) {
            if (isUndefined(controlBlock.functions)) {
                continue;
            }

            controlBlock.functions.reject(error);
        }

        const numDeleted = this.promises.size;
        this.promises.clear();
        this.data.clear();

        return numDeleted;
    }

    /**
     * @param key The key of the `Promise` to settle.
     * @param onExisting The function to call if `key` exists.
     * @param onNew The function to call if `key` doesn't exist.
     * @returns True if `key` didn't exist and `onNew` was called.
     */
    private settle({ key, onExisting, onNew }: {
        key: K;
        onExisting(data: MapData<V>): MapData<V>;
        onNew(): [Promise<V>, MapData<V>];
    }): boolean {
        const maybeData = this.data.get(key);
        const hasKey = !isUndefined(maybeData);

        if (hasKey) {
            const data = maybeData!;
            const newData = onExisting(data);

            this.data.set(key, newData);
        } else {
            const [promise, data] = onNew();

            this.promises.set(key, promise);
            this.data.set(key, data);
        }

        this.setTimeout(key);

        return !hasKey;
    }

    /**
     * @param key The key to resolve.
     * @param data The data pertaining to this existing key.
     * @param value The value to resolve with.
     */
    private resolveExisting({ key, data, value }: {
        key: K;
        data: MapData<V>;
        value: V | PromiseLike<V>;
    }): MapData<V> {
        if (!isUndefined(data.functions)) {
            data.functions.resolve(this.doResolve(key, value));
        } else {
            this.promises.set(key, this.doResolve(key, value));
        }

        return {
            ...removeFunctions(data),
            status: State.Pending,
        };
    }

    /**
     * @param key The key to create.
     * @param value The value to resolve with.
     *
     * @returns The newly created `Promise` and its control data.
     */
    private resolveNew(
        key: K,
        value: V | PromiseLike<V>
    ): [Promise<V>, MapData<V>] {
        return [this.doResolve(key, value), { status: State.Pending }];
    }

    /**
     * @param key The key to reject.
     * @param data The data of the key to reject.
     * @param reason The (optional) reason to reject with.
     */
    private rejectExisting({ key, data, reason }: {
        key: K;
        data: MapData<V>;
        reason?: any;
    }): MapData<V> {
        if (!isUndefined(data.functions)) {
            data.functions.reject(reason);
        } else {
            this.promises.set(key, Promise.reject(reason));
        }

        return {
            ...removeFunctions(data),
            status: State.Rejected,
        };
    }

    /**
     * @param reason The (optional) reason to reject with.
     * @returns The newly rejected `Promise` and its control data.
     */
    private rejectNew(reason?: any): [Promise<V>, MapData<V>] {
        return [Promise.reject(reason), { status: State.Rejected }];
    }

    private async doResolve(key: K, value: V | PromiseLike<V>): Promise<V> {
        try {
            const resolved = await value;
            this.setStatus(key, State.Fulfilled);

            return resolved;
        } catch (error) {
            this.setStatus(key, State.Rejected);

            throw error;
        }
    }

    /**
     * @param key The key to set the status of.
     */
    private setStatus(key: K, status: State): void {
        const maybeExisting = this.data.get(key);

        const toSet = (() => {
            if (typeof maybeExisting === "undefined") {
                return { status };
            }

            return {
                ...maybeExisting,
                status,
            };
        })();

        this.data.set(key, toSet);
    }

    /**
     * Sets a timeout for a key. After at least `this.timeout` milliseconds,
     * will call `PromiseMap#delete` on the specified key.
     *
     * @param key The key to set a timeout on.
     * @returns True if a timeout was set.
     */
    private setTimeout(key: K): boolean {
        const maybeData = this.data.get(key);

        if (isUndefined(maybeData) || isUndefined(this.timeout)) {
            return false;
        }

        if (!isUndefined(maybeData.timer)) {
            clearTimeout(maybeData.timer);
        }

        const doDelete = () => this.doDelete(key, new Error("timed out"));
        const withTimer = {
            ...maybeData,
            timer: setTimeout(doDelete, this.timeout),
        };
        this.data.set(key, withTimer);

        return true;
    }

    /**
     * @param key The key of the `Promise` to delete.
     * @param reason The reason to reject with if `key` is pending.
     * @returns Whether `key` was deleted.
     */
    private doDelete(key: K, reason: Error): boolean {
        const maybeData = this.data.get(key);

        if (!isUndefined(maybeData)) {
            if (!isUndefined(maybeData.functions)) {
                maybeData.functions.reject(reason);
            }

            if (!isUndefined(maybeData.timer)) {
                clearTimeout(maybeData.timer);
            }
        }

        this.data.delete(key);

        return this.promises.delete(key);
    }
}

/**
 * Potential states for a Promise to be in. `Fulfilled` and `Rejected` are both
 * settled states.
 */
enum State {
    Pending,
    Fulfilled,
    Rejected,
}

/**
 * Control block data for a `PromiseMap` entry.
 */
interface MapData<T> {
    readonly functions?: PromiseFunctions<T>;
    readonly status: State;
    readonly timer?: NodeJS.Timer;
}

/**
 * @param data The data that we want to ensure has no `functions` member.
 * @returns A copy of `data` sans `functions`.
 */
const removeFunctions = <T>(data: MapData<T>): MapData<T> => {
    const { functions: _, ...toReturn } = data;

    return toReturn;
};
