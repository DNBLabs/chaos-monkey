# Skeleton only. The AKS + ACR module is deferred to its own ticket
# (deployment-topology.md, "Deferred to downstream tickets"). This file exists so the
# directory is a valid Terraform root and `terraform validate` runs in CI from day one.

resource "azurerm_resource_group" "demo" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    project    = "chaos-monkey"
    lifecycle  = "ephemeral"
    cost-guard = "destroy-after-demo"
  }
}
