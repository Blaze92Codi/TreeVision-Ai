# Security baseline implementation

`node security/check.mjs` validates the restrictive agent policy and scans tracked
text files for selected credential formats. Values are never printed. CI runs the
checker with read-only repository permissions and no retained checkout token.
This is not an exhaustive secret scan, dependency audit, historical scan or runtime
network sandbox. An ordinary app's manual CRUD is not an agent integration.

Unreviewed sensitive agent actions and agent egress remain disabled in the policy.
Changing those fields causes the build check to fail. An application must add and
test a server-side adapter in a reviewed change before relaxing this baseline.
The policy itself does not intercept existing runtime calls. Required adapters:
exact-action human approval, atomic single-use/duplicate prevention, task-scoped
credentials, externally enforced destination restrictions, independent redacted
audit storage, outcome verification and an operator stop/recovery path.

After a suspected control failure: stop the affected execution, preserve evidence
without secrets, determine affected accounts, restore a verified baseline, test
the actual failed boundary and rollback path, then record owner-approved restart.
Do not train or prompt the agent to conceal the behavior instead of fixing it.

Do not merge a failing check or call an application protected merely because this
baseline exists. Repository branch protection, platform egress controls, durable
audit retention and production credential revocation require host configuration.
No such platform settings are changed by these files.
