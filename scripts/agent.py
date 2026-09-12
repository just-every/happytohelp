#!/usr/bin/env python3
"""Transport for a real operator/agent. This program never executes assignments."""
import argparse
import base64
import json
import os
from pathlib import Path
import sys
import uuid
from urllib.parse import quote
sys.dont_write_bytecode = True
from agent_state import State, inventory, private_json
from agent_transport import origin, request
from agent_upload import screenshot


def submit(state, kind, path, body, job=None):
    if state.data.get('pending'):
        raise ValueError('A submission is unresolved. Use retry before submitting another event.')
    state.data['pending'] = {'kind': kind, 'path': path, 'body': body, 'job': job}
    state.save()
    return retry(state)


def retry(state):
    pending = state.data.get('pending')
    if not pending:
        raise ValueError('No pending submission.')
    if pending['kind'] == 'upload':
        response = request(state.data['server'], state.data['token'], 'POST', pending['path'], base64.b64decode(pending['body']['bytes']), pending['body']['mime'])
    else:
        response = request(state.data['server'], state.data['token'], 'POST', pending['path'], pending['body'])
    if pending['kind'] == 'claim' and response.get('job'):
        job = response['job']
        run = response.get('runId', job.get('runId'))
        if not job.get('id') or not run:
            raise ValueError('Invalid claim response; pending claim retained.')
        state.data['jobs'][job['id']] = {'runId': run, 'claim': response}
    state.data['receipts'].append({'submission': pending, 'response': response})
    state.data.pop('pending')
    state.save()
    return response


def run(args):
    with State(args.state) as state:
        if args.command == 'connect':
            server = origin(args.server)
            roots = inventory(args.workspace)
            token = private_json(args.token_file)['token']
            if not isinstance(token, str) or not token or any(c.isspace() for c in token):
                raise ValueError('Invalid token.')
            if state.data.get('pending'):
                raise ValueError('Resolve pending submission before reconnecting.')
            if state.data.get('server') and (state.data['server'] != server or state.data.get('sessionId') != args.session):
                raise ValueError('Use a separate state file for another server or session.')
            response = request(server, token, 'GET', '/api/agent/connect')
            state.data.update(server=server, token=token, sessionId=args.session, workspaces=roots, agent=response['agent'])
            state.save()
            return {'agent': response['agent'], 'workspaces': roots, 'sessionId': args.session}
        if 'token' not in state.data:
            raise ValueError('Connect first.')
        if args.command == 'retry':
            return retry(state)
        if args.command == 'inventory':
            return {'workspaces': inventory([w['path'] for w in state.data['workspaces']])}
        if args.command == 'claim':
            inventory([w['path'] for w in state.data['workspaces']])
            return submit(state, 'claim', '/api/agent/claim', {'sessionId': state.data['sessionId']})
        job = state.data['jobs'].get(args.job)
        if not job:
            raise ValueError('Job was not claimed in this state.')
        path = '/api/agent/jobs/' + quote(args.job, safe='')
        if args.command in ('context', 'check'):
            return request(state.data['server'], state.data['token'], 'GET', path + '/' + args.command + '?runId=' + quote(job['runId'], safe=''))
        if args.command == 'upload':
            return submit(state, 'upload', path + '/attachments?runId=' + quote(job['runId'], safe=''), screenshot(args.file), args.job)
        if args.command == 'heartbeat':
            return submit(state, 'heartbeat', path + '/heartbeat', {'runId': job['runId']}, args.job)
        body = {'runId': job['runId'], 'eventId': str(uuid.uuid4())}
        endpoint = args.command
        if args.command == 'progress':
            body['message'] = args.message
        else:
            endpoint = 'result'
            payload = private_json(args.file) if args.command == 'result' else {'status': 'needs_input', 'result': {'summary': 'Operator input required', 'verified': False, 'actions': [], 'question': args.question}}
            if payload.get('status') not in ('completed', 'needs_input', 'failed', 'cancelled'):
                raise ValueError('Invalid result status.')
            if payload['status'] == 'completed' and payload.get('result', {}).get('verified') is not True:
                raise ValueError('Completed results require verified evidence.')
            body.update(status=payload['status'], result=payload['result'])
        return submit(state, endpoint, path + '/' + endpoint, body, args.job)


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--state', default=str(Path.home() / '.happytohelp' / 'agent.json'))
    commands = p.add_subparsers(dest='command', required=True)
    connect = commands.add_parser('connect')
    for name in ('server', 'session', 'token-file'):
        connect.add_argument('--' + name, required=True)
    connect.add_argument('--workspace', action='append', required=True)
    for name in ('claim', 'retry', 'inventory'):
        commands.add_parser(name)
    for name in ('context', 'check', 'heartbeat', 'progress', 'needs_input', 'result', 'upload'):
        command = commands.add_parser(name)
        command.add_argument('--job', required=True)
        if name == 'progress':
            command.add_argument('--message', required=True)
        elif name == 'needs_input':
            command.add_argument('--question', required=True)
        elif name in ('result', 'upload'):
            command.add_argument('--file', required=True)
    return p


if __name__ == '__main__':
    try:
        print(json.dumps(run(parser().parse_args()), indent=2))
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        # Do not print arbitrary file contents or token-bearing exceptions.
        message = str(error) if isinstance(error, (ValueError, RuntimeError)) else 'Local state or input unavailable; check private files and arguments.'
        print(json.dumps({'error': message}), file=sys.stderr)
        sys.exit(1)
