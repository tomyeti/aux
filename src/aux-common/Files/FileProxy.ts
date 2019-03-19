import { File, FileTags } from './File';
import { FileCalculationContext } from './FileCalculations';

/**
 * The symbol that can be used to tell if an object represents a proxy.
 */
export const isProxy = Symbol('isProxy');

/**
 * The symbol that can be used to get the object that a proxy represents.
 */
export const proxyObject = Symbol('proxyObject');

/**
 * Defines an interface for a file that is being proxied so that
 * formulas are transparently calculated and deep values can be handled transparently.
 */
export interface FileProxy extends FileTags {
    [isProxy]: boolean;
    [proxyObject]: File;
    id: File['id'];
}

/**
 * Creates a new file proxy from the given file and calculation context.
 * @param calc The calculation context to use.
 * @param file The file.
 */
export function createFileProxy(calc: FileCalculationContext, file: File): FileProxy {
    return <FileProxy>new Proxy(file, _createProxyHandler(calc, file.tags));
}


function _createProxyHandler(calc: FileCalculationContext, tags: any, props?: string): ProxyHandler<any> {
    return {
        get: function (target, property) {
            let nextTags = tags;
            if (typeof property === 'symbol') {
                if (property === isProxy) {
                    return true;
                } else if (property === proxyObject) {
                    if (target instanceof Number) {
                        return target.valueOf();
                    } else if (target instanceof Boolean) {
                        return target.valueOf();
                    } else if (target instanceof String) {
                        return target.valueOf();
                    } else {
                        return target;
                    }
                } else if (property === Symbol.toPrimitive) {
                    return function (hint: string) {
                        if (target instanceof Number) {
                            return target.valueOf();
                        } else if (target instanceof Boolean) {
                            return target.valueOf();
                        } else if (target instanceof String) {
                            return target.valueOf();
                        }
                    };
                }
                
                return target[property];
            }

            let fullProp: string = null;
            let val = target[property];
            if (typeof val === 'undefined') {
                fullProp = props ? `${props}.${property}` : property.toString();
                val = target[fullProp];
                if (typeof val === 'undefined') {
                    val = tags[fullProp];
                }
            }

            if (val) {
                fullProp = null;
                nextTags = val;
            }

            if (typeof val === 'boolean') {
                return new Proxy(new Boolean(val), _createProxyHandler(calc, nextTags, fullProp));
            } else if (typeof val === 'number') {
                return new Proxy(new Number(val), _createProxyHandler(calc, nextTags, fullProp));
            } else if (typeof val === 'string') {
                return new Proxy(new String(val), _createProxyHandler(calc, nextTags, fullProp));
            }

            return new Proxy(val || new String(''), _createProxyHandler(calc, nextTags, fullProp));
        },

        apply: function(target: Function, thisArg, args) {
            if (thisArg[isProxy]) {
                thisArg = thisArg[proxyObject];
            }

            return target.apply(thisArg, args);
        }
    };
}