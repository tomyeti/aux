import { ConsoleMessages } from '@casual-simulation/causal-trees';
import { SandboxInterface } from './SandboxInterface';

export interface SandboxMacro {
    test: RegExp;
    replacement: (val: string) => string;
}

/**
 * Defines an interface for objects that represent the result of a calculation from the sandbox.
 */
export interface SandboxResult<TExtra> {
    /**
     * Whether the calculation was successful.
     */
    success: boolean;
    /**
     * The extra data that was passed to the sandbox.
     */
    extras: TExtra;
    /**
     * The result of the sandbox calculation, if any.
     */
    result?: any;
    /**
     * The error that happened inside the sandbox, if any.
     */
    error?: Error;

    /**
     * The console log messages that were produced from the script.
     */
    logs: ConsoleMessages[];
}

/**
 * Defines an interface for an object that contains a set of variables
 * to inject into a sandbox.
 */
export interface SandboxLibrary {
    [key: string]: any;
}

/**
 * Defines an interface for an object that is able to run some code.
 */
export interface Sandbox {
    /**
     * The library that the sandbox should use.
     */
    library: SandboxLibrary;

    /**
     * The interface that the sandbox should use.
     */
    interface: SandboxInterface;

    /**
     * Runs the given formula JavaScript and returns the result.
     * @param formula The formula to run inside the sandbox.
     * @param extras The extra data to include in the run. These extras are passed to the interface during execution.
     * @param context The object that should be mapped to "this" during execution. Enables usage of "this" inside formulas.
     */
    run<TExtra>(
        formula: string,
        extras: TExtra,
        context: any,
        variables?: SandboxLibrary
    ): SandboxResult<TExtra>;
}

/**
 * Defines a type for a function that can create a sandbox.
 */
export type SandboxFactory = (lib: SandboxLibrary) => Sandbox;
