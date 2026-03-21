# Known Limitations

## Operational limitations accepted for the final delivery

### Sales / recibos verdes are not AT-auto-synced

The product supports a dedicated revenue import flow, but it does not claim full automatic AT synchronization of sales/recibos verdes.

### `iva_cadence` is configured manually

The runtime behavior is correct, but the cadence is not inferred automatically from AT. It must be maintained explicitly per client.

### Exempt-client UAT depends on real data availability

The code path is implemented, but final business validation requires a real exempt client in the live/staging dataset.

### Some large-portfolio screens still rely on `fetchAllPages`

This is acceptable for the current delivery, but it remains a scale risk for very large client datasets and should be moved server-side in a follow-up phase.

### Branch protection cannot be fully enforced from the repo alone

CI and ownership files are included, but the final protection rules still need to be enabled in GitHub repository settings.
