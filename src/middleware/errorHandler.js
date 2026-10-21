// One place that turns any error into a consistent JSON response:
//   { success: false, error: "message" }
module.exports = function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  // Friendly messages for common PostgreSQL / PostgREST error codes
  if (err.code === '23505') { status = 409; message = 'This record already exists.'; }
  else if (err.code === '23503') { status = 409; message = 'This record is linked to other data, so it cannot be deleted or changed this way.'; }
  else if (['23514', '22P02', '22007', '22003'].includes(err.code)) { status = 400; message = 'One of the values entered is not valid.'; }
  else if (err.code === 'PGRST116') { status = 404; message = 'Record not found.'; }
  else if (status === 500) { console.error(err); message = 'Something went wrong on the server. Please try again.'; }

  res.status(status).json({ success: false, error: message });
};
