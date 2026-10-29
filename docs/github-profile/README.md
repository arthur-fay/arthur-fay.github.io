# Arthur Fay

**Software Engineer** · New York, NY

**Python · TypeScript / React · FastAPI · PostgreSQL · REST APIs · Automated Testing · CI/CD**

I build backend APIs, data systems and browser interfaces, with particular attention to testability, documentation and what the evidence actually supports. My public work includes a PostgreSQL inventory API, a forecasting-research platform, a business-intelligence project and three interactive engineering labs.

**[Explore The Architect Lab](https://arthur-fay.github.io/)** · **[Review by role](https://arthur-fay.github.io/#hiring)** · **[Experience & education](https://arthur-fay.github.io/#experience)**

**[Email Arthur](mailto:arthur.fay74@gmail.com)** · **[LinkedIn](https://www.linkedin.com/in/arthur-fay/)**

## Selected engineering work

| Project | What you can inspect |
| --- | --- |
| **[Inventory Reservations API](https://github.com/arthur-fay/inventory-reservations-api)** | Synthetic FastAPI/PostgreSQL demonstration with row locks, a stock ledger, retry handling, Alembic migrations and real database concurrency tests. **[Run locally with Docker Compose](https://github.com/arthur-fay/inventory-reservations-api#run-locally)** · **[Transaction tests](https://github.com/arthur-fay/inventory-reservations-api/blob/main/tests/integration/test_concurrency.py)** |
| **[ATLAS — Forecasting Research & API](https://github.com/arthur-fay/demand-forecasting-model)** | Reproducible NYC 311 forecasting evaluation, seven models, 822 historical rolling backtests, a FastAPI service and a React/TypeScript dashboard. **[API contract](https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/API.md)** · **[Research results](https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/BACKTESTING.md)** |
| **[E-Commerce Executive Analytics](https://github.com/arthur-fay/customer-revenue-analytics)** | SQL / Google Colab / Power BI and DAX project, dimensional model, original dashboard files and published summary measures. **[Interactive browser lab](https://arthur-fay.github.io/lab/ecommerce/)** |
| **[Pathfinding Lab](https://arthur-fay.github.io/lab/pathfinding/)** | Browser-based BFS, Dijkstra and A* grid simulation with reproducible scenarios and measured results. **[Source](https://github.com/arthur-fay/arthur-fay.github.io/tree/main/lab/pathfinding)** |
| **[Security Investigation Lab](https://arthur-fay.github.io/lab/security-events/)** | Explainable alert rules and investigation workflow using **synthetic** sign-in events, not a production SIEM. **[Source](https://github.com/arthur-fay/arthur-fay.github.io/tree/main/lab/security-events)** |

### Evidence and limitations matter

The Inventory API is a **local demonstration on synthetic data**, with a shared operator key; it is not a publicly deployed production inventory service.

ATLAS's observed forecasting improvements are **not robustly established**, its prediction intervals **failed their specified calibration criterion**, and its optimization exercises use **hypothetical** assumptions. The ATLAS dashboard is **not a live public deployment**. The E-Commerce lab separates reported summary figures from hypothetical what-if scenarios; it is not a transaction-level recreation. Pathfinding is a grid simulation rather than validated physical robotics, and security detections run entirely on synthetic browser data.

## Professional experience

- **Backend Software Engineer I · Blue Sky Trading (March 2026–present).** I build Python REST APIs, design PostgreSQL schemas and write automated tests. I also develop Python/Java internal applications that integrate with inventory/distribution ERP systems.
- **Data Analyst · 21st Ave Pharmacy & Medical Supply (March 2020–December 2025).** I worked on inventory exceptions, severity-based prioritization and data-integrity work with HIPAA-regulated records.

Employer systems, operational datasets and private code are **not** published here. The public GitHub repositories document my independent work.

## Education

**B.S. Computer Science**, Capella University — *in progress; expected January 2027*.

**A.S. Computer Science**, Borough of Manhattan Community College (CUNY) — *August 2024*.

## How I approach engineering

**Specify the system. Test the behavior. Show the evidence. State the limits.**

The portfolio itself uses plain HTML, CSS and JavaScript under a restrictive Content Security Policy, with automated unit and browser tests. The original E-Commerce Power BI source is a distinct project archive; its public README does not claim the same automated test suite.

## Get in touch

For recruiting inquiries, email [arthur.fay74@gmail.com](mailto:arthur.fay74@gmail.com) or connect on [LinkedIn](https://www.linkedin.com/in/arthur-fay/). Explore the [engineering portfolio](https://arthur-fay.github.io/) and [public GitHub repositories](https://github.com/arthur-fay) for source code, tests and technical evidence.
