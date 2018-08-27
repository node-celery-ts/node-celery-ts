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

import { PromiseFunctions } from "../promise_functions";
import { List } from "./list";

/**
 * FIFO queue for `Promise`s. Supports pushing single elements onto the queue
 * and settling one or all elements in the queue. Implemented using `List`.
 */
export class PromiseQueue<T> {
    private queue: List<PromiseFunctions<T>> = new List<PromiseFunctions<T>>();

    /**
     * @returns A `PromiseQueue` ready to have new `Promise`s queued up.
     */
    public constructor() { }

    /**
     * Time complexity: O(1)
     *
     * @returns A `Promise` that will be settled when its turn comes and
     *          `#resolveOne` or `#rejectOne` is called, or when `#resolveAll`
     *          or `#rejectAll` are called.
     */
    public async push(): Promise<T> {
        const promise = new Promise<T>((resolve, reject) => {
            this.queue.push({ reject, resolve });
        });

        return promise;
    }

    /**
     * Time complexity: O(n), where n is the number of unsettled `Promise`s in
     * the queue.
     *
     * @param value The value to resolve queued `Promise`s with.
     * @returns The number of settled `Promise`s.
     */
    public resolveAll(value: T | PromiseLike<T>): number {
        return invokeWhile(() => this.resolveOne(value));
    }

    /**
     * Time complexity: O(n), where n is the number of unsettled `Promise`s in
     * the queue.
     * @param reason The reason to reject queued `Promise`s with.
     * @returns The number of settled `Promise`s.
     */
    public rejectAll(reason?: any): number {
        return invokeWhile(() => this.rejectOne(reason));
    }

    /**
     * Time complexity: O(1)
     *
     * @param value The value to resolve a queued `Promise` with.
     * @returns True if a `Promise` was dequeued and resolved.
     */
    public resolveOne(value: T | PromiseLike<T>): boolean {
        return this.settleOne("resolve", value);
    }

    /**
     * Time complexity: O(1)
     *
     * @param reason The reason to reject a queued `Promise` with.
     * @returns True if a `Promise` was dequeued and rejected.
     */
    public rejectOne(reason?: any): boolean {
        return this.settleOne("reject", reason);
    }

    /**
     * Time complexity: O(1)
     *
     * @param method The name of the method to invoke.
     * @param argument The argument to pass to the invocation of `method`.
     * @returns True if a `Promise` was dequeued and settled.
     */
    private settleOne(method: "reject" | "resolve", argument?: any): boolean {
        const maybeHead = this.queue.shift();

        if (typeof maybeHead === "undefined") {
            return false;
        }

        const toSettle = maybeHead;

        if (method === "reject") {
            toSettle.reject(argument);
        } else if (method === "resolve") {
            toSettle.resolve(argument);
        }

        return true;
    }
}

/**
 * @param invocable A function to invoke until it returns false.
 * @returns The number of times `true` was returned from invoking `invocable`.
 */
const invokeWhile = (condition: () => boolean): number => {
    let numTrue = 0;

    while (condition()) {
        ++numTrue;
    }

    return numTrue;
};
