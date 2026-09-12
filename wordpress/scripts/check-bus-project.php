<?php
// Integration test in the isolated preview; intercepts every Betterplace call.
require '/var/www/html/wp-load.php';
if (PHP_SAPI !== 'cli' || wp_get_environment_type() !== 'local') {
    exit('Local CLI only.');
}
function check_bus($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
function reset_bus_cache() {
    delete_transient('bkw_bus_project_v1');
    delete_transient('bkw_bus_project_retry');
    delete_option('bkw_bus_project_last_good');
}
$fixture = array('id' => 184020, 'donated_amount_in_cents' => 312550, 'open_amount_in_cents' => 487450,
    'donations_count' => 49, 'progress_percentage' => 39, 'donations_prohibited' => false,
    'completed_at' => null, 'closed_at' => null);
$calls = 0;
$mode = 'success';
add_filter('pre_http_request', function ($pre, $args, $url) use (&$calls, &$mode, &$fixture) {
    check_bus($url === 'https://api.betterplace.org/de/api_v4/projects/184020.json', 'Unexpected outgoing URL');
    $calls++;
    if ($mode === 'error') return new WP_Error('http_request_failed', 'Test outage');
    return array('response' => array('code' => 200), 'body' => $mode === 'malformed' ? '{' : json_encode($fixture));
}, 10, 3);
reset_bus_cache();
try {
    rest_get_server();
    wp_set_current_user(0);
    $response = rest_do_request('/bkw/v1/bus-project');
    $data = $response->get_data();
    check_bus($response->get_status() === 200, 'Public endpoint rejected');
    check_bus($response->get_headers()['Cache-Control'] === 'no-store, max-age=0', 'Response may be cached by proxy');
    check_bus($data['donated_cents'] === 312550 && $data['goal_cents'] === 800000, 'Incorrect cent amounts');
    check_bus($data['percentage'] === 39 && $data['donations_count'] === 49 && !$data['stale'], 'Incorrect project state');
    bkw_bus_project_data();
    check_bus($calls === 1, 'Fresh data did not use cache');
    delete_transient('bkw_bus_project_v1');
    $mode = 'error';
    $stale = bkw_bus_project_data();
    check_bus($stale['stale'] && $stale['donated_cents'] === 312550 && $stale['fetched_at'] === $data['fetched_at'], 'Outage lost last good data');
    bkw_bus_project_data();
    check_bus($calls === 2, 'Outage retries not throttled');
    reset_bus_cache();
    $mode = 'malformed';
    check_bus(rest_do_request('/bkw/v1/bus-project')->get_status() === 503, 'Malformed upstream data not rejected');
    foreach (array('donated_amount_in_cents' => '100', 'open_amount_in_cents' => -1, 'donations_count' => null,
        'id' => 12, 'donations_prohibited' => 'false', 'closed_at' => 'not a date') as $key => $bad) {
        $invalid = $fixture;
        $invalid[$key] = $bad;
        check_bus(bkw_bus_normalize($invalid) === null, 'Invalid field accepted: ' . $key);
    }
    $zero = $fixture;
    $zero['donated_amount_in_cents'] = 0;
    $zero['progress_percentage'] = 0;
    check_bus(bkw_bus_normalize($zero)['percentage'] === 0, 'Zero progress invalid');
    $fixture['completed_at'] = gmdate('c');
    check_bus(bkw_bus_normalize($fixture)['status'] === 'funded', 'Completed status missing');
    check_bus(bkw_bus_normalize($fixture)['can_donate'], 'Funded open project incorrectly blocks donations');
    $fixture['donations_prohibited'] = true;
    check_bus(bkw_bus_normalize($fixture)['status'] === 'paused' && !bkw_bus_normalize($fixture)['can_donate'], 'Paused status missing');
    $fixture['closed_at'] = gmdate('c');
    check_bus(bkw_bus_normalize($fixture)['status'] === 'closed' && !bkw_bus_normalize($fixture)['can_donate'], 'Closed status missing');
    echo "PASS: public API, cent precision, cache, failure fallback, retry limit, invalid data and project states.\n";
} finally {
    reset_bus_cache();
}
