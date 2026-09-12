<?php
defined('ABSPATH') || exit;

/** Public project totals only; no donor data or browser requests to Betterplace. */
function bkw_bus_normalize($project) {
    if (!is_array($project) || ($project['id'] ?? null) !== 184020) {
        return null;
    }
    foreach (array('donated_amount_in_cents', 'open_amount_in_cents', 'donations_count', 'progress_percentage') as $key) {
        if (!isset($project[$key]) || !is_int($project[$key]) || $project[$key] < 0) {
            return null;
        }
    }
    if (!isset($project['donations_prohibited']) || !is_bool($project['donations_prohibited'])) {
        return null;
    }
    foreach (array('completed_at', 'closed_at') as $key) {
        if (!array_key_exists($key, $project) ||
            ($project[$key] !== null && (!is_string($project[$key]) || strtotime($project[$key]) === false))) {
            return null;
        }
    }
    return array(
        'project_id' => 184020,
        'donated_cents' => $project['donated_amount_in_cents'],
        'goal_cents' => $project['donated_amount_in_cents'] + $project['open_amount_in_cents'],
        'open_cents' => $project['open_amount_in_cents'],
        'donations_count' => $project['donations_count'],
        'percentage' => min(100, $project['progress_percentage']),
        'status' => $project['closed_at'] ? 'closed' : ($project['donations_prohibited'] ? 'paused' :
            ($project['completed_at'] ? 'funded' : 'active')),
        'can_donate' => !$project['donations_prohibited'] && !$project['closed_at'],
        'fetched_at' => gmdate('c'),
        'stale' => false,
    );
}

function bkw_bus_project_data() {
    $cached = get_transient('bkw_bus_project_v1');
    if (is_array($cached)) {
        return $cached;
    }
    // Also limits retries during outages and concurrent requests during a refresh.
    if (!get_transient('bkw_bus_project_retry')) {
        set_transient('bkw_bus_project_retry', 1, MINUTE_IN_SECONDS);
        $response = wp_remote_get('https://api.betterplace.org/de/api_v4/projects/184020.json', array(
            'timeout' => 8,
            'redirection' => 0,
            'limit_response_size' => 262144,
            'headers' => array('Accept' => 'application/json'),
        ));
        if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
            $data = bkw_bus_normalize(json_decode(wp_remote_retrieve_body($response), true));
            if ($data !== null) {
                set_transient('bkw_bus_project_v1', $data, 15 * MINUTE_IN_SECONDS);
                update_option('bkw_bus_project_last_good', $data, false);
                delete_transient('bkw_bus_project_retry');
                return $data;
            }
        }
    }
    $last_good = get_option('bkw_bus_project_last_good');
    if (is_array($last_good)) {
        $last_good['stale'] = true;
        return $last_good;
    }
    return new WP_Error('bkw_bus_unavailable', 'Spendenstand derzeit nicht verfügbar.', array('status' => 503));
}

add_action('rest_api_init', function () {
    register_rest_route('bkw/v1', '/bus-project', array(
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            $data = bkw_bus_project_data();
            $response = is_wp_error($data)
                ? new WP_REST_Response(array('message' => $data->get_error_message()), 503)
                : new WP_REST_Response($data);
            // The server caches Betterplace data. Page/CDN/browser caches must
            // not freeze the displayed timestamp or mask an unavailable source.
            $response->header('Cache-Control', 'no-store, max-age=0');
            return $response;
        },
    ));
});

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script('bkw-bus-project', get_theme_file_uri('/bus-project.js'), array(), '0.2.1', true);
    wp_add_inline_script('bkw-bus-project', 'window.bkwBusProject = ' . wp_json_encode(array(
        'endpoint' => rest_url('bkw/v1/bus-project'),
    )) . ';', 'before');
});
