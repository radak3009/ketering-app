UPDATE pickup_requests 
SET fiscal_status = 'pending', 
    invoice_number = NULL, 
    verification_url = NULL, 
    receipt_file_path = NULL, 
    receipt_text_top = NULL, 
    receipt_text_bottom = NULL, 
    fiscalized_at = NULL, 
    octopos_weborder_id = NULL,
    fiscal_external_id = NULL,
    fiscal_error = NULL
WHERE id = '8c676525-68d0-4c40-b6a6-96907f7006b0'