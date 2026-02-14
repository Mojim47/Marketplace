// Adapter overrides to relax strict typing where vendor libs differ
declare module 'memcached' {
  export type CommandData = any;
}
