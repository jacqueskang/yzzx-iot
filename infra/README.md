# Infra (Terraform)

This folder provisions Azure resources for this project: Azure Resource Group, Azure Digital Twins (ADT), and a Linux Azure Function App.

## Prerequisites
- Terraform >= 1.5
- Azure CLI (`az`) authenticated: `az login`
- Select subscription if needed: `az account set --subscription "<SUBSCRIPTION_NAME_OR_ID>"`

## Quick Start
1. Initialize Terraform:
   ```bash
   terraform -chdir=infra init
   ```
2. Review plan:
   ```bash
   terraform -chdir=infra plan
   ```
3. Apply:
   ```bash
   terraform -chdir=infra apply
   ```

## Variables
- `suffix` (string): Naming suffix appended to resources, e.g., `dev`
- `location` (string): Azure region, e.g., `eastus`
- `resource_group_name` (string): Existing RG to deploy into; leave empty to create `rg-<suffix>`
- `tags` (map): Optional common tags


- Function App runs on the **classic Linux Consumption** plan (`Y1`) with Node.js v22 and Functions v4.
- The Function App is granted `Azure Digital Twins Data Owner` on the ADT instance via managed identity.
- To enable remote state, configure a backend (Azure Storage) and run `terraform init -migrate-state`. Not included by default.

## Cleanup
```bash
terraform -chdir=infra destroy
```
