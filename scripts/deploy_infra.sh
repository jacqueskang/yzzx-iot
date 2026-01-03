#!/bin/bash
set -euo pipefail

# Deploy Azure infrastructure using Terraform
cd "$(dirname "$0")/../infra"
terraform init -input=false
terraform apply -var-file=terraform.tfvars -auto-approve
cd ..
