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

import { ParseError } from "./errors";

import * as Events from "events";

/**
 * Follows the same rules as C/C++ integral literal parsing, stripping away
 * whitespace on the left or right before attempting to parse.
 * Examples: "0644" -> 420, "0x20" -> 32, "0b101" -> 5, "  15 " => 15
 *
 * @param maybeInt A a non-negative base-{2,8,10,16} integer.
 * @returns The parsed integer.
 *
 * @throws ParseError If the string is not a non-negative integer.
 */
export const parseInteger = (maybeInt: string): number => {
    const [radix, toParse] = (() => {
        const toReturn = getRadix(maybeInt);

        if (isNullOrUndefined(toReturn)) {
            throw new ParseError("Celery.Utility.parseInteger: could not "
                                 + `parse ${maybeInt} as integer`);
        }

        return toReturn;
    })();

    const maybeParsed = Number.parseInt(toParse, radix);

    return maybeParsed;
};

/**
 * Strips whitespace on the left and right and parses case-insensitively.
 * "true" | "1" | "on" | "yes" -> true
 * "false" | "0" | "off" | "no" -> false
 *
 * @param maybeBoolean A boolean value.
 * @returns The parsed boolean value.
 *
 * @throws ParseError If the string is not a boolean value.
 */
export const parseBoolean = (maybeBoolean: string): boolean => {
    switch (maybeBoolean.toLowerCase().trim()) {
    case "true": case "1": case "on": case "yes": return true;
    case "false": case "0": case "off": case "no": return false;
    }

    throw new ParseError("Celery.Utility.parseBoolean: could not parse "
                         + `${maybeBoolean} as a boolean`);
};

/**
 * @param value A potentially null or undefined value.
 * @returns `value is null | undefined`.
 */
export const isNullOrUndefined = <T>(
    value: T | null | undefined
): value is null | undefined => isNull(value) || isUndefined(value);

/**
 * @param value A potentially null value.
 * @returns `value is null`.
 */
export const isNull = <T>(value: T | null): value is null => value === null;

/**
 * @param value A potentially undefined value.
 * @returns `value is undefined`.
 */
export const isUndefined = <T>(value: T | undefined): value is undefined =>
    typeof value === "undefined";

/**
 * Converts from snake_case to camelCase.
 *
 * @param toConvert The string to convert.
 * @returns A camelCase string.
 */
export const toCamelCase = (toConvert: string): string =>
    toConvert.replace(/_([a-z])/, (_, match) => match.toUpperCase());

/**
 * Implemented using `EventEmitter#once`.
 *
 * @param emitter The emitter to listen to.
 * @param name The name of the event.
 * @returns A `Promise` that settles when the specified emitter emits an event
 *          with matching name.
 */
export const promisifyEvent = async <T>(
    emitter: Events.EventEmitter,
    name: string | symbol,
): Promise<T> => new Promise<T>((resolve) => emitter.once(name, resolve));

/**
 * @param emitter The emitter to listen to.
 * @param filterMap A function that maps the arguments of the
 *                  emitted event to a value of type `U` if a filtering
 *                  condition is met. Otherwise, returns `undefined`.
 * @param name The name of the event.
 * @returns A `Promise` that settles when the specified emitter emits an event
 *          with matching name and the filtering condition is met.
 */
export const filterMapEvent = async <T>({ emitter, filterMap, name }: {
    emitter: Events.EventEmitter;
    filterMap(...args: Array<any>): T | undefined;
    name: string | symbol;
}): Promise<T> => new Promise<T>((resolve) => {
    let resolved = false;

    const onEvent = (...values: Array<any>) => {
        // this may not be necessary, but just in case...
        if (resolved) {
            return;
        }

        const maybeMapped = filterMap(...values);

        if (!isNullOrUndefined(maybeMapped)) {
            emitter.removeListener(name, onEvent);
            resolve(maybeMapped);
            resolved = true;
        }
    };

    emitter.addListener(name, onEvent);
});

/**
 * Implemented using `Promise.race` and `createTimerPromise`. If `timeout` is
 * `undefined`, will not set a timeout.
 *
 * @param timeout The time (in milliseconds) to wait before rejecting.
 * @param promise The `Promise` to race.
 * @returns A `Promise` that will follow `promise` or reject after at least
 *          `timeout` milliseconds, whichever comes first.
 *
 * @see createTimerPromise
 */
export const createTimeoutPromise = async <T>(
    promise: T | PromiseLike<T>,
    timeout?: number
): Promise<T> => {
    if (isNullOrUndefined(timeout)) {
        return promise;
    }

    return Promise.race([promise, createTimerPromise(timeout)]);
};

/**
 * Implemented using `setTimeout`.
 *
 * @param timeout The time (in milliseconds) to wait before rejecting.
 * @returns A `Promise` that rejects after at least `timeout` milliseconds.
 */
export const createTimerPromise = async (timeout: number): Promise<never> =>
    new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timed out")), timeout)
    );

/**
 * Set of valid numeric bases accepted by `parseInteger`.
 */
type Radix = 2 | 8 | 10 | 16;

/**
 * @param maybeNumber A potentially valid string representation of a
 *                    base-{2,8,10,16} number.
 * @returns If `maybeNumber` is a valid numeric string, the detected `Radix` and
 *          the string to parse, sans base prefixes. Otherwise, `undefined`.
 */
const getRadix = (maybeNumber: string): [Radix, string] | undefined => {
    // four groups - one for octal, one for hex, one for binary,
    // and one for decimal - that match in that order
    const REGEX: RegExp =
        /^(?:(0[0-7]*)|(?:0x([\da-f]+))|(?:0b([01]+))|([1-9][\d]*))$/;
    const OCTAL_INDEX: number = 1;
    const HEX_INDEX: number = 2;
    const BINARY_INDEX: number = 3;
    const DECIMAL_INDEX: number = 4;

    const trimmedLowered = maybeNumber.toLowerCase().trim();
    const maybeMatches = REGEX.exec(trimmedLowered);

    if (isNullOrUndefined(maybeMatches)) {
        return undefined;
    }

    const matches = maybeMatches;

    if (!isNullOrUndefined(matches[OCTAL_INDEX])) {
        return [8, matches[OCTAL_INDEX]];
    } else if (!isNullOrUndefined(matches[HEX_INDEX])) {
        return [16, matches[HEX_INDEX]];
    } else if (!isNullOrUndefined(matches[BINARY_INDEX])) {
        return [2, matches[BINARY_INDEX]];
    }

    // one of them had to match for the regex to not be null
    return [10, matches[DECIMAL_INDEX]];
};
