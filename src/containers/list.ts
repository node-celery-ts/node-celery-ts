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

import { isNullOrUndefined } from "../utility";

/**
 * `List` is a sequence container that supports constant-time insertion and
 * removal from the front and back of the container. It does not support
 * random access, meaning there is no indexing operator. It is implemented as a
 * doubly-linked list.
 */
export class List<T> implements Iterable<T> {
    private head?: Node<T> = undefined;
    private tail?: Node<T> = undefined;
    private size: number = 0;

    /**
     * @returns An empty `List`.
     */
    public constructor() { }

    /**
     * @returns The number of elements contained in this `List`.
     */
    public get length(): number {
        return this.size;
    }

    /**
     * Time complexity: O(n), where n is the number of elements iterated over.
     *
     * @param init The sequence to populate a `List` with.
     * @returns A `List` with all elements shallowly copied from `init`.
     */
    public static from<T>(init: Iterable<T>): List<T> {
        const list = new List<T>();

        for (const elem of init) {
            list.push(elem);
        }

        return list;
    }

    /**
     * Implemented using #from.
     * Time complexity: O(n), where n is the number of arguments.
     *
     * @param elements The elements to copy into a new `List`.
     * @returns A `List` of elements shallowly copied from the arguments.
     *
     * @see from
     */
    public static of<T>(...elements: Array<T>): List<T> {
        return List.from(elements);
    }

    /**
     * Time complexity: O(n), where n is the number of arguments.
     *
     * @param elements The elements to append onto the back of this `List`.
     * @returns The number of elements contained in this `List.`
     */
    public push(...elements: Array<T>): number {
        for (const element of elements) {
            this.pushOne(element);
        }

        return this.size;
    }

    /**
     * Removes the element at the back of the `List`, if it exists.
     * Time complexity: O(1)
     *
     * @returns `undefined` if the `List` is empty, else the removed element.
     */
    public pop(): T | undefined {
        if (isNullOrUndefined(this.tail)) {
            return undefined;
        }

        --this.size;

        const popped = this.tail.element;
        this.tail = this.tail.previous;

        if (!isNullOrUndefined(this.tail)) {
            this.tail.next = undefined;
        } else {
            this.head = undefined;
        }

        return popped;
    }

    /**
     * Removes the element at the front of the `List`, if it exists.
     * Time complexity: O(1)
     *
     * @returns `undefined` if the `List` is empty, else the removed element.
     */
    public shift(): T | undefined {
        if (isNullOrUndefined(this.head)) {
            return undefined;
        }

        --this.size;

        const shifted = this.head.element;
        this.head = this.head.next;

        if (!isNullOrUndefined(this.head)) {
            this.head.previous = undefined;
        } else {
            this.tail = undefined;
        }

        return shifted;
    }

    /**
     * Appends elements as if concatenating onto the front.
     * Time complexity: O(n), where n is the number of arguments.
     *
     * @param elements The elements to append onto the front of this `List`.
     * @returns The number of elements contained in this `List.`
     */
    public unshift(...elements: Array<T>): number {
        for (let i = elements.length - 1; i >= 0; --i) {
            this.unshiftOne(elements[i]);
        }

        return this.size;
    }

    /**
     * @returns An iterable iterator over the elements in this `List`.
     */
    public *[Symbol.iterator](): IterableIterator<T> {
        let current: Node<T> | undefined = this.head;

        while (!isNullOrUndefined(current)) {
            const toYield = current.element;
            current = current.next;

            yield toYield;
        }

        return;
    }

    /**
     * @param element The element to append to the back of the `List`.
     * @returns The number of elements in the `List`.
     */
    private pushOne(element: T): number {
        ++this.size;

        const toPush = {
            element,
            next: undefined,
            previous: this.tail,
        };

        if (isNullOrUndefined(this.tail)) {
            this.head = toPush;
            this.tail = toPush;
        } else {
            this.tail.next = toPush;
            this.tail = toPush;
        }

        return this.size;
    }

    /**
     * @param element The element to append to the front of the `List`.
     * @returns The number of elements in the `List`.
     */
    private unshiftOne(element: T): number {
        ++this.size;

        const toUnshift = {
            element,
            next: this.head,
            previous: undefined,
        };

        if (isNullOrUndefined(this.head)) {
            this.head = toUnshift;
            this.tail = toUnshift;
        } else {
            this.head.previous = toUnshift;
            this.head = toUnshift;
        }

        return this.size;
    }
}

/**
 * Doubly-linked list node.
 */
interface Node<T> {
    element: T;
    next?: Node<T>;
    previous?: Node<T>;
}
