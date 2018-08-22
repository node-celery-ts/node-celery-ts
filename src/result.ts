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

import { ResultMessage } from "./messages";
import { ResultBackend } from "./result_backend";
import { createTimeoutPromise, isNullOrUndefined } from "./utility";

/**
 * The result of a task invocation. Asynchronously fetched.
 */
export class Result<T> {
    private readonly backend: ResultBackend;
    private readonly taskId: string;
    private readonly result: Promise<T>;

    /**
     * Will immediately begin waiting for the result to be fetched.
     *
     * @param taskId UUID of the task whose result we are requesting.
     * @param backend The backend to receive the result on.
     * @returns A `Result` that will fetch from `backend` when possible.
     */
    public constructor(taskId: string, backend: ResultBackend) {
        this.taskId = taskId;
        this.backend = backend;
        this.result = this.getResult();
    }

    /**
     * Fetches the result from the backend. May resolve immediately if the
     * result was already fetched after the transaction was queued up in
     * the constructor.
     *
     * @param timeout The duration to wait, in milliseconds, before rejecting
     *                the `Promise`. If undefined, will not set a timeout.
     * @returns A `Promise` that will resolve to the result of the task after
     *          it is fetched from the backend.
     */
    public async get(timeout?: number): Promise<T> {
        return createTimeoutPromise(this.result, timeout);
    }

    /**
     * Deletes the result from the backend. If the result has not been received
     * yet, will immediately discard it.
     *
     * @returns A `Promise` that resolves to the response of the result backend.
     */
    public async delete(): Promise<string> {
        return this.backend.delete(this.taskId);
    }

    /**
     * @returns A `Promise` that resolves to the result fetched from the
     *          result backend.
     */
    private async getResult(): Promise<T> {
        const message = await this.backend.get<T>({ taskId: this.taskId });

        return message.result;
    }
}
