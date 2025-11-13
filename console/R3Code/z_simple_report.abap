REPORT z_simple_report.

TABLES: kna1.

SELECT-OPTIONS: s_kunnr FOR kna1-kunnr.

START-OF-SELECTION.
  SELECT * FROM kna1
    WHERE kunnr IN s_kunnr.
  
  LOOP AT kna1 INTO DATA(kna1_data).
    WRITE: / kna1_data-kunnr, kna1_data-name1, kna1_data-ort01.
  ENDLOOP.