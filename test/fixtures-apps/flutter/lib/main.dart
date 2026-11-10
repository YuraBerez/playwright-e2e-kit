import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

/// Fixture app of the playwright-e2e-kit self-tests. It mirrors the React and Vue fixtures:
/// a name field, a Greet button and a greeting, plus a long virtualised list for
/// `scrollUntilVisible`. Every widget the specs touch has a `Semantics(identifier:)`.
///
/// It does NOT call `ensureSemantics()` by default, so the kit must turn the semantics tree on
/// through the `flt-semantics-placeholder`. Open it with `?semantics=on` to test the other path.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  if (Uri.base.queryParameters['semantics'] == 'on') {
    SemanticsBinding.instance.ensureSemantics();
  }
  runApp(const FixtureApp());
}

class FixtureApp extends StatelessWidget {
  const FixtureApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Kit fixture (Flutter)',
      debugShowCheckedModeBanner: false,
      home: GreeterPage(),
    );
  }
}

class GreeterPage extends StatefulWidget {
  const GreeterPage({super.key});

  @override
  State<GreeterPage> createState() => _GreeterPageState();
}

class _GreeterPageState extends State<GreeterPage> {
  final _name = TextEditingController();
  String _greeting = '';

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _greet() => setState(() => _greeting = 'Hello, ${_name.text}!');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text('Kit fixture', style: Theme.of(context).textTheme.headlineMedium),
              ),
              const SizedBox(height: 8),
              Semantics(
                identifier: 'name-input',
                child: TextField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
              ),
              const SizedBox(height: 8),
              Semantics(
                identifier: 'greet-button',
                child: ElevatedButton(onPressed: _greet, child: const Text('Greet')),
              ),
              const SizedBox(height: 8),
              Semantics(
                identifier: 'greeting',
                liveRegion: true,
                child: Text(_greeting),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Semantics(
                  identifier: 'item-list',
                  child: ListView.builder(
                    itemCount: 200,
                    itemBuilder: (context, i) => Semantics(
                      identifier: 'item-$i',
                      child: ListTile(title: Text('Item $i')),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
