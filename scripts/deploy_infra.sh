#!/bin/bash
set -euo pipefail

# Deploy Azure infrastructure using Terraform
cd "$(dirname "$0")/../infra"
terraform init -input=false
terraform apply -auto-approve
cd ..
