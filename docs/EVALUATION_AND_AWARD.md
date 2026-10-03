# Evaluation and Transactional Award

Starting evaluation closes the commercial submission phase and moves active quotations into review.

Awarding is atomic:

1. validate buyer ownership and RFQ state;
2. validate selected quotation/supplier;
3. award winner;
4. reject active competitors;
5. award RFQ;
6. create PO header/items as immutable commercial snapshots;
7. write audit/notification state.

Database uniqueness on the RFQ-to-PO relationship provides an additional guard against issuing multiple POs for one RFQ.
