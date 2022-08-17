terraform {
  backend "remote" {
    hostname = "app.terraform.io"
    organization = "VargasArts"
    workspaces {
      prefix = "roam-service-social"
    }
  }
  required_providers {
    github = {
      source = "integrations/github"
      version = "4.2.0"
    }
  }
}

variable "aws_access_token" {
  type = string
}

variable "aws_secret_token" {
  type = string
}

variable "twitter_consumer_key" {
    type = string
}

variable "twitter_consumer_secret" {
    type = string
}

variable "developer_token" {
  type = string
}

variable "github_token" {
  type = string
}


provider "aws" {
    region = "us-east-1"
    access_key = var.aws_access_token
    secret_key = var.aws_secret_token
}

module "aws_cron_job" {
  source    = "dvargas92495/cron-job/aws"
  
  rule_name = "RoamJS"
  schedule  = "rate(1 minute)"
  lambdas    = [
    "schedule-twitter"
  ]
  tags      = {
    Application = "Roam JS Extensions"
  }
}

resource "aws_dynamodb_table" "social-messages" {
  name           = "RoamJSSocial"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "uuid"

  attribute {
    name = "uuid"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  attribute {
    name = "channel"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    hash_key           = "channel"
    range_key          = "date"
    name               = "primary-index"
    non_key_attributes = []
    projection_type    = "ALL"
    read_capacity      = 0
    write_capacity     = 0
  }

  global_secondary_index {
    hash_key           = "userId"
    range_key          = "channel"
    name               = "user-index"
    non_key_attributes = []
    projection_type    = "ALL"
    read_capacity      = 0
    write_capacity     = 0
  }

  tags = {
    Application = "Roam JS Extensions"
  }
}

module "roamjs_lambda" {
  source = "dvargas92495/lambda/roamjs"
  providers = {
    aws = aws
    github = github
  }

  name = "twitter"
  lambdas = [
    { 
      path = "twitter-auth", 
      method = "post"
    },
    {
      path = "twitter-feed",
      method = "get"
    },
    {
      path = "twitter-login",
      method = "post"
    },
    {
      path = "twitter-schedule",
      method = "get"
    },
    {
      path = "twitter-schedule",
      method = "post"
    },
    {
      path = "twitter-search",
      method = "get"
    },
    {
      path = "twitter-tweet",
      method = "post"
    },
    {
      path = "twitter-upload",
      method = "post"
    },
    {
      path = "twitter-schedule",
      method = "put"
    },
    {
      path = "twitter-schedule",
      method = "delete"
    },
  ]
  aws_access_token = var.aws_access_token
  aws_secret_token = var.aws_secret_token
  github_token     = var.github_token
  developer_token  = var.developer_token
}

provider "github" {
    owner = "dvargas92495"
    token = var.github_token
}

resource "github_actions_secret" "twitter_consumer_key" {
  repository       = "roamjs-twitter"
  secret_name      = "TWITTER_CONSUMER_KEY"
  plaintext_value  = var.twitter_consumer_key
}

resource "github_actions_secret" "twitter_consumer_secret" {
  repository       = "roamjs-twitter"
  secret_name      = "TWITTER_CONSUMER_SECRET"
  plaintext_value  = var.twitter_consumer_secret
}
