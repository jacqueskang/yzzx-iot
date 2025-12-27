terraform {
  backend "azurerm" {
    resource_group_name  = "rg-jkang-shared"
    storage_account_name = "stjkangshared"
    container_name       = "tfstates"
    key                  = "yzzx-iot.tfstate"
    subscription_id      = "673b4b78-11f8-4da7-8199-8a3ca1545cf1"
    use_azuread_auth     = true
  }
}
