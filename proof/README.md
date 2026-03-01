# Proof README

- Run date/time: 2026-03-01 (Asia/Bangkok)
- Selected profile ID: `poll_station`
- Naming mode: `compact`
- Proof style: `tx_sim_focus`
- Payout Trac address: `trac1svbgaulcrypto09payout09placeholder09replace09me09`

## Command Set

- Mutating: `create_poll`
- Query: `poll_results`
- Extra: `cast_vote`

Example commands:
- `/tx --command "{\"op\":\"create_poll\",\"poll_id\":\"poll_1\",\"question\":\"Ship release this week?\",\"options\":[\"yes\",\"no\"]}" --sim 1`
- `/tx --command "{\"op\":\"cast_vote\",\"poll_id\":\"poll_1\",\"option\":\"yes\"}" --sim 1`
- `/tx --command "poll_results" --sim 1`

## Artifact List

- `proof/run.log`
- `proof/run-screenshot.png`
- `proof/command-mapping.log`
- `proof/README.md`
- `proof/tx-sim.log`

## Variation Note

This run differs from prior pair-style examples by using a lifecycle poll flow (`create_poll` + `cast_vote` + `poll_results`) and SC-Bridge tx simulation capture.

