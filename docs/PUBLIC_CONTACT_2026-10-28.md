# Public recruiting contact — 28 October 2026

The owner supplied **arthur.fay74@gmail.com** and **https://www.linkedin.com/in/arthur-fay/** in response to the request for the exact contact details to publish on the portfolio and GitHub introduction.

## Result

- The homepage contact card offers **Email Arthur** and **Connect on LinkedIn**, with the email address visible and selectable in the contact list.
- The four existing GitHub source links remain available in that list. Email is the primary recruiting action; visitors no longer need to have received the résumé first.
- The maintained GitHub profile README includes the same contact destinations near the introduction and under **Get in touch**.
- External LinkedIn links use `noopener noreferrer`. The email link contains only the exact selected recipient, with no extra recipients or preset fields.
- The privacy checker permits only those exact contact values on the homepage. Other addresses, mail fields, LinkedIn profiles, phone numbers and contact details on lab/error pages remain rejected.

No résumé download, phone number or employer material is published. No email was sent, and no LinkedIn message or connection request was submitted.

The GitHub profile contact update was published in commit `8ade4afc4e627113b576db2c79b344b8a3d5b99b`; the root README was read back and matches the maintained text exactly.

## Verification limits

The exact LinkedIn URL was opened in the review browser. LinkedIn redirected it to an authentication wall with the requested profile preserved as the destination. The profile contents and ownership could not be independently verified while signed out; the link is owner-supplied. Search did not return an indexed match for this exact profile. The portfolio does not label the profile independently verified.

The email recipient and `mailto:` formatting were checked against the owner's text. Mailbox ownership and deliverability were not tested by sending a message.

## Validation

- Offline site, anchor, asset-version, CSP and JavaScript checks: passed.
- Unit tests: 220 passed, including adverse contact-policy cases.
- Desktop and narrow mobile contact layouts were reviewed in the managed preview; email and LinkedIn destinations match the owner's text.
- The local automated browser suite could not launch because its Chromium executable is absent. GitHub Actions runs the full browser suite and visual screenshot checks before merge; the pull request records their final results.
