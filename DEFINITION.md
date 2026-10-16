# Team Pulse — Product Requirements & Implementation Brief

## 1. Product vision

Build a lightweight engineering team health and continuous improvement application that combines:

- **Team Pulse:** recurring, short surveys to understand team health, delivery confidence, autonomy, workload and clarity.
- **Retrospectives:** collaborative sessions where the team identifies problems, groups similar topics, votes on priorities and agrees on concrete actions.
- **Action tracking:** follow-up of improvement actions across retrospectives, including ownership, deadlines, status and effectiveness.

The main objective is to create a continuous improvement loop:

**Measure → Reflect → Prioritize → Act → Follow up → Measure again.**

The application should be simple, fast and pleasant to use. Avoid unnecessary features, complex permissions and over-engineering.

## 2. Main users and roles

### Engineering Manager / Facilitator

Can:
- Create and schedule retrospectives.
- Configure Team Pulse surveys.
- Facilitate the retrospective workflow.
- Review survey results and historical trends.
- Create, assign and track improvement actions.
- Review outstanding actions from previous retrospectives.

### Team member

Can:
- Answer Team Pulse surveys.
- Participate in retrospectives.
- Add topics, comments and votes.
- Participate in grouping and prioritizing topics.
- View agreed improvement actions and their status.
- Update actions assigned to them.

Keep permissions simple. Avoid introducing an elaborate role-based access control system unless the existing application architecture requires it.

## 3. Core application sections

Implement four main sections:

1. **Overview:** team health, upcoming retrospective and outstanding actions.
2. **Team Pulse:** surveys and historical trends.
3. **Retrospectives:** list of sessions and collaborative retrospective workflow.
4. **Actions:** centralized list of improvement actions and their progress.

## 4. Team Pulse surveys

### Purpose

Collect a small amount of regular feedback without creating survey fatigue.

Surveys should take approximately 30–60 seconds to complete.

### Survey questions

Support configurable questions using a 1–5 scale. Provide sensible default questions such as:

1. **Team health:** How are you feeling about the team right now?
2. **Delivery confidence:** How confident are you that we can deliver our current commitments?
3. **Autonomy:** Do you have enough autonomy to do your work effectively?
4. **Priority clarity:** Are our priorities and expectations clear?
5. **Workload:** How manageable is your current workload?
6. **Team collaboration:** How well are we collaborating and supporting each other?

Use question-specific labels where appropriate. For example:

- Team health: 1 = Very bad, 5 = Very good.
- Delivery confidence: 1 = Not confident, 5 = Very confident.
- Autonomy: 1 = Very low, 5 = Very high.
- Priority clarity: 1 = Very unclear, 5 = Very clear.
- Workload: 1 = Completely unmanageable, 5 = Very manageable.
- Collaboration: 1 = Very poor, 5 = Excellent.

For workload, a high score must always mean a healthier situation. Do not interpret a high workload score as more work or more productivity.

Optionally include one free-text question:

"What is the main thing helping or hurting the team right now?"

Make this question configurable and optional.

### Survey lifecycle

Support:
- Creating a survey.
- Opening and closing a survey.
- Submitting one response per participant per survey.
- Editing a response while the survey remains open, if permitted by the implementation.
- Viewing aggregated results after the survey closes.
- Comparing results with previous surveys.

Surveys should be configurable as recurring, for example before every retrospective or every two weeks.

### Privacy

Prefer anonymous responses by default.

- Do not display individual ratings to the manager.
- Show aggregated results and response counts.
- Consider a minimum response threshold before displaying detailed results.
- Keep free-text feedback separate from identifiable user information.
- Explain anonymity limitations clearly if the application cannot technically guarantee it.

Do not build individual employee performance scores from survey answers.

### Results and trends

Show:
- Average score per question.
- Distribution of ratings from 1 to 5.
- Change compared with the previous surveys
- Response rate, where participant counts are available.
- Strongest and weakest areas.
- Optional historical trend chart last 5 surveys.

Use trends to identify areas for discussion, not to judge individuals.

## 5. Retrospective workflow

Implement a guided, multi-stage retrospective inspired by Retrium.

The facilitator should be able to create a retrospective from a template and progress through the stages.

### Stage 1 — Prepare

The facilitator creates a retrospective with:
- Title.
- Team.
- Date.
- Optional sprint, milestone or period.
- Facilitator.
- Participants, team members.
- Template.
- Optional retrospective goal.

Show outstanding actions from the previous retrospective so the team can review them before starting.

Allow the facilitator to choose a template, such as:
- What went well / What could improve / Actions.
- Start / Stop / Continue.
- Mad / Sad / Glad.
- Open discussion.

Keep the template system simple and extensible.

### Stage 2 — Collect topics

Team members independently submit topics or observations.

Each topic contains:
- Short title.
- Optional description.
- Category or board column.
- Author, if the session configuration permits displaying it.
- Creation timestamp.

Allow participants to add multiple topics.

During this stage:
- Participants can view submitted topics according to the session settings.
- Topics can be edited or deleted by their authors before the stage closes.
- The facilitator can manage the stage.
- Avoid exposing authors if anonymous input is enabled.

Provide a clean board-style interface with cards grouped by category.

### Stage 3 — Group similar topics

Allow participants and the facilitator to group related topics into clusters.

Users should be able to:
- Create a group.
- Rename a group.
- Move topics between groups.
- Merge groups.
- Ungroup topics.

Example:

Three topics:
- "Too many interruptions during development."
- "We keep changing priorities mid-sprint."
- "Meetings break our focus."

These could be grouped under "Lack of focus and priority stability."

Allow the facilitator to make final adjustments.

Do not require AI to group topics. Manual grouping must work fully. AI-assisted suggestions can be considered as a future enhancement.

### Stage 4 — Vote

Allow participants to vote on the topics or groups they consider most important.

Requirements:
- The facilitator configures the number of votes per participant.
- Default: three votes per participant.
- A participant can allocate votes according to a simple, clearly defined rule.
- Prevent users from exceeding their vote allowance.
- Support anonymous voting.
- Display aggregated vote counts.
- Allow the facilitator to close voting.
- Sort results by vote count.

After voting closes, highlight the highest-priority topics.

Define tie-breaking behavior clearly and avoid making it unnecessarily complex.

### Stage 5 — Discuss and identify root causes

The team discusses the highest-priority groups.

For each group, allow the facilitator to record:
- Summary of the problem.
- Impact on the team.
- Possible root causes.
- Context or examples.
- Decision: create an action, monitor the situation, or accept the issue for now.

Avoid requiring lengthy documentation. The goal is to produce a useful conversation, not a report.

### Stage 6 — Define actions

Convert selected discussion topics into concrete improvement actions.

Each action should contain:
- Title.
- Description.
- Related retrospective.
- Related topic or group.
- One directly responsible owner.
- Optional collaborators.
- Due date.
- Priority.
- Status.
- Creation date.
- Completion date.
- Optional success criteria.

Statuses:
- Open.
- In progress.
- Done.
- Cancelled.

Actions must be specific enough to be executed and reviewed.

Example:

Problem: Priorities change too frequently during the sprint.

Action: Introduce an explicit approval step for scope changes after sprint planning.

Owner: Engineering Manager.

Due date: Before the next sprint starts.

Success criteria: All mid-sprint scope changes are documented with an explicit decision and impact.

Avoid generating multiple vague actions for the same problem. Prefer a small number of clear, owned commitments.

### Stage 7 — Close retrospective

The facilitator closes the retrospective.

Generate a summary containing:
- Number of topics submitted.
- Highest-priority topics.
- Main discussion points.
- Agreed actions.
- Owners and due dates.
- Outstanding actions carried over from previous retrospectives.

Preserve the session history so the team can revisit previous decisions.

## 6. Action tracking across retrospectives

This is a core feature, not an optional extra.

Provide a centralized action dashboard with:
- All open actions.
- Actions in progress.
- Overdue actions.
- Actions completed recently.
- Actions grouped by retrospective.
- Actions grouped by owner.

Allow filtering by status, owner, due date and retrospective.

At the beginning of each new retrospective:
- Show actions from previous sessions.
- Review their current status.
- Highlight overdue actions.
- Allow the facilitator to discuss whether completed actions had the intended effect.

When an action is completed, optionally record:
- Outcome.
- Whether the action helped.
- Follow-up notes.

Do not automatically mark actions as complete simply because a new retrospective starts.

Provide a simple action history so the team can understand what was agreed, changed, completed or cancelled over time.

## 7. Overview dashboard

Create a concise team overview with four sections:

### Team health
- Latest Team Pulse scores.
- Trends compared with previous surveys.
- Areas requiring discussion.

### Current retrospective
- Upcoming or active session.
- Current stage.
- Link to resume the session.

### Improvement actions
- Open actions.
- Overdue actions.
- Actions completed since the previous retrospective.

### Continuous improvement
- Previous retrospective summaries.
- Recurring topics.
- Actions that repeatedly remain open.
- Historical trends in team health.

Avoid creating a single overall team health score that hides meaningful differences between dimensions.

## 8. Recommended end-to-end workflow

The intended recurring workflow is:

1. Send a short Team Pulse survey before the retrospective.
2. Review aggregated results.
3. Start the retrospective.
4. Review outstanding actions from the previous session.
5. Collect topics independently.
6. Group similar topics.
7. Vote on priorities.
8. Discuss the most important topics.
9. Agree on a small number of concrete actions.
10. Assign an owner and deadline to every action.
11. Track progress during the following weeks.
12. Review the actions and the next Team Pulse results in the following retrospective.

The workflow must also support running a retrospective without a Team Pulse survey.

## 9. Data model

Use a straightforward relational model, adapted to the existing project's conventions.

Suggested entities:

- Team
- TeamMember
- PulseSurvey
- PulseQuestion
- PulseResponse
- PulseAnswer
- Retrospective
- RetrospectiveParticipant
- RetrospectiveTopic
- RetrospectiveTopicGroup
- RetrospectiveVote
- ImprovementAction
- ActionUpdate

Use stable IDs and explicit relationships.

A topic can belong to a group. A group can be linked to multiple actions if necessary, but the interface should encourage a manageable number of actions.

An action can be linked to its originating retrospective and remain open across subsequent sessions.

For anonymous surveys, separate response data from user identity and do not store unnecessary identifying information.

Use the project's existing authentication and persistence infrastructure wherever possible.

## 10. UX and design principles

- Prioritize desktop usability during facilitated retrospectives.
- Keep the interface responsive for mobile survey participation.
- Make the current retrospective stage obvious.
- Provide clear controls to move forward and backward between stages where safe.
- Prevent accidental loss of submitted topics, votes and actions.
- Use loading, empty, error and confirmation states consistently.
- Use accessible color contrast and clear status labels.
- Use a card-based collaborative board for topics and groups.
- Use charts only when they provide useful historical insight.
- Keep the visual design consistent across surveys, retrospectives and actions.

Do not build real-time collaborative editing infrastructure unless the existing stack makes it straightforward and there is a real need. Refreshing or polling data is an acceptable initial solution.

## 11. Technical implementation constraints

First inspect the existing repository and identify:
- Framework and architecture.
- Authentication and authorization.
- Database and ORM.
- UI component library and styling conventions.
- Existing design tokens.
- Testing infrastructure.
- Deployment process.

Then implement the feature following the existing conventions.

If starting from scratch, prefer:
- TypeScript.
- React for the frontend.
- NestJS for the backend.
- A relational database such as PostgreSQL.
- Tailwind CSS for styling.
- A small, maintainable architecture.

Do not introduce a new framework, database or infrastructure component without a concrete reason.

Implement:
- Typed API contracts.
- Server-side validation.
- Appropriate authorization.
- Unit tests for business rules.
- Data-driven tests using `test.each` where appropriate.
- Integration tests for the retrospective lifecycle and action tracking.
- Tests for anonymous surveys and vote limits.
- Basic end-to-end coverage for the primary workflow.

Keep business logic separate from UI components and avoid over-engineering abstractions.

## 12. MVP scope

The first version must include:

1. Team Pulse surveys with configurable 1–5 questions.
2. Aggregated survey results and historical comparisons.
3. Retrospective creation and guided stages.
4. Topic submission and grouping.
5. Voting with configurable limits.
6. Discussion notes.
7. Action creation, assignment, deadlines and status.
8. A centralized action dashboard.
9. Carryover of outstanding actions into subsequent retrospectives.
10. A basic team overview.

Do not include initially:
- AI-generated retrospective analysis.
- Slack or Microsoft Teams integrations.
- Complex notifications and automation rules.
- Advanced analytics or predictive scoring.
- Multiple organizations or a sophisticated tenant management system.
- Gamification or individual productivity rankings.

## 13. Acceptance criteria

The MVP is complete when:

- A facilitator can create and run a retrospective from beginning to end.
- Multiple participants can submit topics and vote within the configured limits.
- Similar topics can be grouped and prioritized.
- The facilitator can convert discussion topics into assigned actions.
- Actions retain their history and remain visible until resolved.
- Outstanding actions appear in the next retrospective.
- Participants can complete a Team Pulse survey without seeing other participants' individual responses.
- The manager can compare aggregated results over time.
- The application works without requiring external paid services.
- Core business rules are covered by automated tests.
- The implementation follows the existing project's architecture and is documented.

## 14. Implementation approach

Work in small, verifiable increments.

First, inspect the repository and propose a concise implementation plan. Identify the data model, the main user flows and the minimum required screens.

Then implement the MVP in vertical slices, validating each slice with tests before moving to the next.

Do not stop after producing a plan or a report. Once the plan is clear, proceed with implementation unless a genuine blocker requires clarification.

Prioritize a working end-to-end experience over polishing isolated screens or building infrastructure that the MVP does not need.

The final result should help the Engineering Manager and the team answer three questions:

1. How are we doing?
2. What should we improve?
3. Are we actually following through on the improvements we agreed on?
