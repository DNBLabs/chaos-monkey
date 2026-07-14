variable "resource_group_name" {
  description = "Resource group holding the ephemeral demo cluster."
  type        = string
  default     = "chaos-monkey-demo"
}

variable "location" {
  description = "Azure region for the demo cluster."
  type        = string
  default     = "uksouth"
}

variable "node_count" {
  description = "AKS node count. Two nodes let pod-kill chaos and minReplicas=2 behave realistically."
  type        = number
  default     = 2
}

variable "node_size" {
  description = "AKS node SKU. Smallest on-demand size that runs the demo."
  type        = string
  default     = "Standard_B2s"
}
