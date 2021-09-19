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

import { ResultMessage } from "./messages";

/**
 * ResultBackend manages interactions with databases and result queues.
 */
export interface ResultBackend {
    /**
     * @param message The result to push onto the backend.
     * @returns A Promise that resolves to the response of the backend after
     *          the result message has been received.
     */
    put<T>(message: ResultMessage<T>): Promise<string>;

    /**
     * @param taskId The UUID of the task whose result is to be fetched.
     * @param timeout The time to wait before rejecting the promise. If
     *                undefined, no timeout will be set.
     * @returns A Promise that resolves to the result fetched from the backend.
     */
    get<T>({ taskId, timeout }: GetOptions): Promise<ResultMessage<T>>;

    /**
     * @param taskId The UUID of the task whose result is to be deleted from
     *               the backend.
     * @returns A Promise that resolves to the response of the backend after
     *          the result has been deleted.
     */
    delete(taskId: string): Promise<string>;

    /**
     * Forcefully terminates the connection with the backend. To be called once.
     *
     * @returns A Promise that resolves when the connection has been closed.
     */
    disconnect(): Promise<void>;

    /**
     * Gently terminates the connection with the backend. To be called once.
     *
     * @returns A Promise that resolves when all pending transactions have
     *          been completed and the connection has been closed.
     */
    end(): Promise<void>;

    /**
     * @returns A lossy representation of this backend's options.
     */
    uri(): string;
}

/**
 * Options for ResultBackend#get().
 */
export interface GetOptions {
    /** A task UUID. */
    taskId: string;
    /** In milliseconds. */
    timeout?: number;
}
