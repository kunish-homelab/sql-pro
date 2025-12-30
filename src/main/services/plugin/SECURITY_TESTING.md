# Plugin Sandboxing and Security Testing

This document describes the comprehensive security tests for the plugin system.

## Test Coverage

The `PluginSandboxSecurity.integration.test.ts` file provides end-to-end security verification for the plugin sandboxing system.

### 1. Malicious Plugin - Node.js API Access Prevention

Tests that verify plugins cannot access dangerous Node.js APIs:

- **Test: Prevent fs module access** - Verifies plugins cannot `require('fs')` to access the filesystem
- **Test: Prevent process object access** - Verifies plugins cannot access `process.env` or other process properties
- **Test: Prevent eval/Function constructor** - Verifies plugins cannot use `eval()` or `new Function()` to break out of sandbox

**Why this matters**: Prevents malicious plugins from reading sensitive files, executing system commands, or accessing environment variables containing secrets.

### 2. Plugin Isolation - Main App State Access Prevention

Tests that verify plugin execution contexts are isolated from each other and the main app:

- **Test: Prevent global state access** - Verifies plugins cannot access global variables from the main application
- **Test: Prevent cross-plugin data access** - Verifies Plugin A cannot read Plugin B's storage data
- **Test: Isolate execution contexts** - Verifies plugins cannot see variables defined in other plugins

**Why this matters**: Prevents data leaks between plugins and protects sensitive application state from plugin access.

### 3. Memory Limit Enforcement

Tests that verify the runtime enforces memory limits on plugins:

- **Test: Terminate memory-hogging plugins** - Verifies plugins that allocate excessive memory are terminated
- **Test: Log memory limit errors** - Verifies memory limit violations are logged for debugging

**Why this matters**: Prevents runaway plugins from consuming system resources and degrading application performance.

### 4. Plugin Crash Isolation

Tests that verify plugin crashes don't affect the main application:

- **Test: Isolate plugin crashes** - Verifies a crashing plugin doesn't crash the main app
- **Test: Handle runtime errors gracefully** - Verifies errors in plugin hooks are caught and logged
- **Test: Prevent infinite loops with timeout** - Verifies plugins with infinite loops are terminated

**Why this matters**: Ensures application stability even when plugins have bugs or malicious code.

### 5. Comprehensive Security Validation

Tests that verify the complete security model:

- **Test: Well-behaved plugin passes all checks** - Verifies legitimate plugins work correctly
- **Test: Report suspicious behavior** - Verifies suspicious API access attempts are logged
- **Test: Runtime availability detection** - Documents when isolated-vm is unavailable
- **Test: Fallback mode security limitations** - Documents reduced security in fallback mode

## Security Architecture

### Two-Mode Operation

The plugin runtime operates in two modes:

1. **Sandboxed Mode** (with isolated-vm):
   - True V8-level isolation
   - Memory limits enforced (default: 128MB)
   - Execution timeouts enforced
   - No access to Node.js APIs
   - Complete process isolation

2. **Fallback Mode** (without isolated-vm):
   - Uses Function constructor for basic isolation
   - No memory limits
   - No timeout enforcement
   - Reduced security (development only)
   - Documented limitations

### Security Layers

1. **API Surface Control**: Plugins only have access to approved Plugin API methods
2. **Context Isolation**: Each plugin runs in its own execution context
3. **Storage Isolation**: Each plugin has its own isolated storage namespace
4. **Resource Limits**: Memory and execution time limits prevent resource exhaustion
5. **Error Isolation**: Plugin errors don't propagate to main application

## Test Execution

Run the security tests with:

```bash
pnpm test PluginSandboxSecurity.integration.test.ts
```

Or run all plugin tests:

```bash
pnpm test plugin
```

## Expected Results

All tests should pass in both modes:

- **Sandboxed Mode**: All security features active, strongest protection
- **Fallback Mode**: Basic isolation only, documented limitations accepted

## Security Considerations for Production

1. **Always use isolated-vm in production**: The fallback mode is for development only
2. **Monitor plugin resource usage**: Track memory and CPU usage per plugin
3. **Log security events**: Record all sandbox violations for analysis
4. **Regular security audits**: Review plugin code before installation
5. **Permission system**: Future enhancement to require explicit user consent for sensitive APIs

## Known Limitations

### Fallback Mode (without isolated-vm)

When isolated-vm is not available (e.g., in test environments or if native module compilation fails):

- ❌ No memory limits enforced
- ❌ No true process isolation
- ❌ No timeout enforcement
- ❌ Plugins may access Node.js APIs via scope escape
- ✅ Basic context isolation via Function constructor
- ✅ API surface control still enforced

**Recommendation**: Only use fallback mode for development and testing. Production deployments must have isolated-vm available.

### Sandboxed Mode (with isolated-vm)

Even with isolated-vm, consider:

- ⚠️ Plugins can still consume CPU cycles within memory/timeout limits
- ⚠️ Malicious plugins can waste resources up to configured limits
- ⚠️ Side-channel attacks may be possible (timing, resource observation)

**Recommendation**: Implement additional monitoring and rate limiting in production.

## Future Security Enhancements

1. **Code Signing**: Verify plugin authenticity via digital signatures
2. **Permission System**: Require user approval for sensitive API access
3. **Sandbox Escape Detection**: Monitor for common escape techniques
4. **Resource Quotas**: Limit disk I/O, network access, and API call rates
5. **Security Auditing**: Automated static analysis of plugin code
6. **Reputation System**: Community ratings and security reports

## Reporting Security Issues

If you discover a security vulnerability in the plugin system:

1. **Do not** open a public issue
2. Email security concerns to the maintainers
3. Include a proof-of-concept if possible
4. Allow time for patching before public disclosure
