# HighLevel API v2 — Complete OAuth Scopes Reference

Source: [HighLevel Scopes Documentation](https://marketplace.gohighlevel.com/docs/Authorization/Scopes/)

## Voice AI (Required for This Project)

| Scope | Access | Level |
|---|---|---|
| `voice-ai-dashboard.readonly` | View call logs | Sub-Account |
| `voice-ai-agents.readonly` | View Voice AI agents | Sub-Account |
| `voice-ai-agents.write` | Create and modify Voice AI agents | Sub-Account |
| `voice-ai-agent-goals.readonly` | View agent actions/goals | Sub-Account |
| `voice-ai-agent-goals.write` | Manage agent actions/goals | Sub-Account |

## Ad Publishing

| Scope | Access |
|---|---|
| `adPublishing.readOnly` | Read ad campaigns, Facebook/Google/LinkedIn integrations, reporting |
| `adPublishing.write` | Manage ads, campaigns, pixels, audiences, integrations |

## Businesses

| Scope | Access |
|---|---|
| `businesses.readonly` | GET /businesses |
| `businesses.write` | Create, update, delete business records |

## Calendars

| Scope | Access |
|---|---|
| `calendars.readonly` | View calendar data |
| `calendars.write` | Create and modify calendar entries |
| `calendars/groups.readonly` | View calendar groups |
| `calendars/groups.write` | Manage calendar groups |
| `calendars/resources.readonly` | View calendar resources |
| `calendars/resources.write` | Manage calendar resources |
| `calendars/events.readonly` | View events and blocked slots |
| `calendars/events.write` | Create appointments and block slots |

## Campaigns

| Scope | Access |
|---|---|
| `campaigns.readonly` | View campaigns |

## Contacts

| Scope | Access |
|---|---|
| `contacts.readonly` | GET /contacts/:contactId and related endpoints |
| `contacts.write` | Create, modify contacts, tasks, notes, tags |

## Conversations

| Scope | Access |
|---|---|
| `conversations.readonly` | View conversation data |
| `conversations.write` | Create and modify conversations |
| `conversations/message.readonly` | Access messages and transcriptions |
| `conversations/message.write` | Send and manage messages |

## Custom Objects

| Scope | Access |
|---|---|
| `objects/schema.readonly` | Read object schemas |
| `objects/schema.write` | Modify object schemas |
| `objects/record.readonly` | Read object records |
| `objects/record.write` | Create, update, delete records |

## Forms & Surveys

| Scope | Access |
|---|---|
| `forms.readonly` | View forms and submissions |
| `forms.write` | Upload custom form files |
| `surveys.readonly` | View surveys and submissions |

## Invoices & Estimates

| Scope | Access |
|---|---|
| `invoices.readonly` | View invoices |
| `invoices.write` | Create and manage invoices |
| `invoices/schedule.readonly` | View scheduled invoices |
| `invoices/schedule.write` | Manage invoice scheduling |
| `invoices/template.readonly` | View invoice templates |
| `invoices/template.write` | Create invoice templates |
| `invoices/estimate.readonly` | View estimates |
| `invoices/estimate.write` | Create and manage estimates |

## Links

| Scope | Access |
|---|---|
| `links.readonly` | View trigger links |
| `links.write` | Create and modify trigger links |

## Locations

| Scope | Access |
|---|---|
| `locations.readonly` | View location data |
| `locations.write` | Create and modify locations |
| `locations/customValues.readonly` | View custom values |
| `locations/customValues.write` | Manage custom values |
| `locations/customFields.readonly` | View custom fields |
| `locations/customFields.write` | Manage custom fields |
| `locations/tags.readonly` | View location tags |
| `locations/tags.write` | Manage location tags |
| `locations/templates.readonly` | View templates |
| `locations/tasks.readonly` | Search location tasks |

## Media & Funnels

| Scope | Access |
|---|---|
| `medias.readonly` | View media files |
| `medias.write` | Upload media files |
| `funnels/redirect.readonly` | View redirect settings |
| `funnels/redirect.write` | Manage redirects |
| `funnels/page.readonly` | View funnel pages |
| `funnels/funnel.readonly` | View funnels |
| `funnels/pagecount.readonly` | View page counts |

## Opportunities

| Scope | Access |
|---|---|
| `opportunities.readonly` | Search and view opportunities |
| `opportunities.write` | Create and modify opportunities |

## Payments

| Scope | Access |
|---|---|
| `payments/integration.readonly` | View payment integrations |
| `payments/integration.write` | Configure payment providers |
| `payments/orders.readonly` | View orders |
| `payments/orders.write` | Manage order fulfillments |
| `payments/transactions.readonly` | View transactions |
| `payments/subscriptions.readonly` | View subscriptions |
| `payments/coupons.readonly` | View coupons |
| `payments/coupons.write` | Create and modify coupons |
| `payments/custom-provider.readonly` | View custom providers |
| `payments/custom-provider.write` | Manage custom payment providers |

## Products

| Scope | Access |
|---|---|
| `products.readonly` | View products and reviews |
| `products.write` | Create and modify products |
| `products/prices.readonly` | View product pricing |
| `products/prices.write` | Manage product prices |
| `products/collection.readonly` | View product collections |
| `products/collection.write` | Manage collections |

## OAuth & SaaS (Agency-Level)

| Scope | Access |
|---|---|
| `oauth.readonly` | View installed locations |
| `oauth.write` | Generate location tokens |
| `saas/location.read` | View SaaS locations |
| `saas/location.write` | Update SaaS subscriptions |
| `saas/company.read` | View SaaS companies |
| `saas/company.write` | Disable SaaS for companies |
| `snapshots.readonly` | View snapshots |
| `snapshots.write` | Share snapshots |

## Social Planner

| Scope | Access |
|---|---|
| `socialplanner/account.readonly` | View social media accounts |
| `socialplanner/account.write` | Manage accounts |
| `socialplanner/csv.readonly` | View CSV data |
| `socialplanner/csv.write` | Manage CSV uploads |
| `socialplanner/category.readonly` | View categories |
| `socialplanner/oauth.readonly` | Access social OAuth flows |
| `socialplanner/oauth.write` | Authorize social accounts |
| `socialplanner/post.readonly` | View posts |
| `socialplanner/post.write` | Create and modify posts |
| `socialplanner/tag.readonly` | View tags |
| `socialplanner/statistics.readonly` | View post statistics |

## Users & Workflows

| Scope | Access |
|---|---|
| `users.readonly` | View users |
| `users.write` | Create and modify users (SENSITIVE — triggers warning) |
| `workflows.readonly` | View workflows |

## Content & Docs

| Scope | Access |
|---|---|
| `courses.write` | Import course content |
| `blogs/post.write` | Create blog posts |
| `blogs/post-update.write` | Modify blog posts |
| `blogs/check-slug.readonly` | Validate blog post URLs |
| `blogs/category.readonly` | View blog categories |
| `blogs/author.readonly` | View blog authors |

## Associations

| Scope | Access |
|---|---|
| `associations.readonly` | View associations |
| `associations.write` | Create and modify associations |
| `associations/relation.readonly` | View relations |
| `associations/relation.write` | Manage relations |

## Email

| Scope | Access |
|---|---|
| `emails/builder.readonly` | View email templates |
| `emails/builder.write` | Create email templates |
| `emails/schedule.readonly` | View scheduled emails |

## Companies & Marketplace

| Scope | Access |
|---|---|
| `companies.readonly` | View company data |
| `custom-menu-link.readonly` | View custom menus |
| `custom-menu-link.write` | Manage custom menus |
| `documents_contracts/list.readonly` | View proposals |
| `documents_contracts/sendlink.write` | Send proposals |
| `documents_contracts_templates/list.readonly` | View proposal templates |
| `documents_contracts_templates/sendlink.write` | Send templates |
| `marketplace-installer-details.readonly` | View app installations |
| `charges.readonly` | View marketplace charges |
| `charges.write` | Create marketplace charges |
| `phonenumbers.read` | View phone numbers |
| `numberpools.read` | View number pools |

## Access Levels

- **Sub-Account (Location)**: Access to individual location data
- **Agency (Company)**: Access to agency-wide operations, can generate location tokens from agency tokens

Scopes are **locked once an app goes live** — modifiable only in draft mode.
