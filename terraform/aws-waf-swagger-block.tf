resource "aws_wafv2_web_acl" "swagger_protection" {
  name  = "nextgen-swagger-protection"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "BlockSwaggerPaths"
    priority = 1

    action {
      block {}
    }

    statement {
      or_statement {
        statement {
          byte_match_statement {
            search_string = "/api/docs"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "CONTAINS"
          }
        }
        statement {
          byte_match_statement {
            search_string = "/swagger"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "STARTS_WITH"
          }
        }
        statement {
          byte_match_statement {
            search_string = "swagger.json"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "CONTAINS"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SwaggerBlockRule"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AllowInternalStaging"
    priority = 0

    action {
      allow {}
    }

    statement {
      and_statement {
        statement {
          byte_match_statement {
            search_string = "internal-staging.nextgen-market.ir"
            field_to_match {
              single_header {
                name = "host"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "EXACTLY"
          }
        }
        statement {
          byte_match_statement {
            search_string = "/api/docs"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "CONTAINS"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "InternalStagingAllowRule"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "SwaggerProtectionACL"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "nextgen-swagger-protection"
    Environment = "production"
    Purpose     = "Block Swagger documentation exposure"
  }
}

resource "aws_cloudfront_distribution" "api_distribution" {
  web_acl_id = aws_wafv2_web_acl.swagger_protection.arn

  origin {
    domain_name = "api.nextgen-market.ir"
    origin_id   = "nextgen-api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled = true

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "nextgen-api"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "X-CSRF-Token"]
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "nextgen-api-distribution"
    Environment = "production"
  }
}