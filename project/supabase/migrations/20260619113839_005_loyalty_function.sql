CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_user_id uuid,
  p_points integer,
  p_type text,
  p_description text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  SELECT loyalty_points INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  IF p_type = 'earned' THEN
    v_new_balance := v_current_balance + p_points;
  ELSIF p_type = 'redeemed' OR p_type = 'expired' THEN
    v_new_balance := v_current_balance - p_points;
  ELSE
    v_new_balance := v_current_balance + p_points;
  END IF;

  UPDATE profiles
  SET loyalty_points = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO loyalty_transactions (
    user_id,
    type,
    points,
    order_id,
    description,
    balance_after
  )
  VALUES (
    p_user_id,
    p_type,
    p_points,
    p_order_id,
    p_description,
    v_new_balance
  );
END;
$$;