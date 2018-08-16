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
 * ignores case, autodetects radix like C, throws ParseError on failure
 * will not parse negative numbers
 * @param maybeInt a string which may be parsable as an integer
 * @returns the parsed integer
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
 * attempts to parse a string as a boolean value, case-insensitive
 * "true", "1", "on", and "yes" are true
 * "false", "0", "off", and "no" are false
 * other inputs will throw Celery.Errors.ParseError
 * @param maybeBoolean the string to attempt parsing
 * @returns the parsed boolean
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
 * @param value a possibly null or undefined value
 * @returns a type assertion if value is null or undefined
 */
export const isNullOrUndefined =
<T>(value: T | null | undefined): value is null | undefined =>
    value === null || typeof value === "undefined";

/**
 * Replaces all instances of _([a-z]) with (1).toUpperCase()
 *
 * @param toConvert the string to convert from snake_case to camelCase
 * @returns a camelCase string
 */
export const toCamelCase = (toConvert: string): string =>
    toConvert.replace(/_([a-z])/, (_, match) => match.toUpperCase());

/**
 * Returns a promise that resolves when an event is emitted
 *
 * @param emitter the emitter to listen to
 * @param name the name of the event to await
 * @returns a promise which resolves when the event is emitted
 */
export const promisifyEvent = <T>(
    emitter: Events.EventEmitter,
    name: string | symbol
): Promise<T> => new Promise((resolve) => emitter.once(name, resolve));

/**
 * Returns a promise that resolves when an event is fired and a
 * filter condition is valid, then maps the arguments of the event handler
 *
 * @param emitter the emitter to listen to
 * @param filterMap function that takes the output of an event; returns
 *                  undefined if the event should be ignored and a mapped output
 *                  otherwise
 * @param name the name of the event to await
 * @returns a promise which fulfils to the first event that passes the predicate
 */
export const filterMapEvent = <U>({ emitter, filterMap, name }: {
    emitter: Events.EventEmitter;
    filterMap(...args: Array<any>): U | undefined;
    name: string | symbol;
}): Promise<U> => new Promise((resolve) => {
    const onEvent = (...values: Array<any>) => {
        const maybeMapped = filterMap(...values);

        if (!isNullOrUndefined(maybeMapped)) {
            emitter.removeListener(name, onEvent);
            resolve(maybeMapped);
        }
    };

    emitter.addListener(name, onEvent);
});

/**
 * @param timeout The time (in milliseconds) to wait before rejecting.
 * @param promise The Promise to wait on.
 * @returns A Promise that will resolve what promise resolves to if it resolves
 *          before the timeout expires, else will reject with a timeout error.
 */
export const createTimeoutPromise = <T>(
    promise: T | PromiseLike<T>,
    timeout?: number
): Promise<T> => {
    if (isNullOrUndefined(timeout)) {
        return Promise.resolve(promise);
    }

    return Promise.race([
        promise,
        createTimerPromise<T>(timeout),
    ]);
};

/**
 * @param timeout The time (in milliseconds) to wait before rejecting.
 * @returns A Promise that will reject after a specified duration.
 */
export const createTimerPromise = <T>(timeout: number): Promise<T> =>
    new Promise<T>((_, reject) => {
        const timer = setTimeout(
            () => {
                clearTimeout(timer);

                reject(new Error(
                    "Celery.Utility.createTimerPromise: timed out"
                ));
            },
            timeout
        );
    });

/** @ignore */
type Radix = 2 | 8 | 10 | 16;

/** @ignore */
const getRadix = (maybeNumber: string): [Radix, string] | undefined => {
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
