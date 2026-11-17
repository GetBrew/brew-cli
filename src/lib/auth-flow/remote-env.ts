/**
 * Where a browser on this machine is not the person's browser: a cloud
 * shell, a remote SSH session, an in-browser WebContainer, CI. Sign-in there
 * never tries to open one; it prints the link and code for any device, and
 * the poll works the same (nothing travels back through the browser).
 */
export type RemoteEnv = {
  /** Display name for the message, e.g. `GitHub Codespaces`. */
  readonly name: string
}

export function detectRemoteEnv(
  env: Readonly<Record<string, string | undefined>>,
  versions: Readonly<Record<string, string | undefined>> = process.versions
): RemoteEnv | undefined {
  if (isSet(env.CODESPACES)) {
    return { name: 'GitHub Codespaces' }
  }
  if (isSet(env.REPL_ID)) {
    return { name: 'Replit' }
  }
  if (isSet(env.GITPOD_WORKSPACE_ID)) {
    return { name: 'Gitpod' }
  }
  if (isSet(versions.webcontainer)) {
    return { name: 'a WebContainer' }
  }
  if (
    (isSet(env.SSH_CONNECTION) ||
      isSet(env.SSH_CLIENT) ||
      isSet(env.SSH_TTY)) &&
    !isSet(env.DISPLAY) &&
    !isSet(env.WAYLAND_DISPLAY)
  ) {
    return { name: 'an SSH session' }
  }
  if (isSet(env.CI)) {
    return { name: 'CI' }
  }
}

/** Present, and not one of the usual "off" spellings. */
function isSet(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false'
}
