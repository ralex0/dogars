declare module 'callback-to-async-iterator' {
    let asyncify : <T>(t: (m: (t: T) => void) => void) => AsyncIterableIterator<T>;
    export default asyncify;
}