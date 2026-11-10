// Fixture app of the playwright-e2e-kit self-tests. It mirrors the React, Vue and Flutter
// fixtures: a name field, a Greet button and a greeting, plus a long lazy list for
// `scrollUntilVisible`. Every composable the specs touch has a `Modifier.testTag`, which Compose
// web renders as the DOM `id` of its accessibility node.
//
// The text field gets a `contentDescription`: Compose web does not expose the `label` of a
// `TextField` as an accessible name.
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.ComposeViewport
import kotlinx.browser.document

@Composable
fun GreeterPage() {
    var name by remember { mutableStateOf("") }
    var greeting by remember { mutableStateOf("") }
    MaterialTheme {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                "Kit fixture",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() }.testTag("heading"),
            )
            Spacer(Modifier.height(8.dp))
            TextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                singleLine = true,
                modifier = Modifier.semantics { contentDescription = "Name" }.testTag("name-input"),
            )
            Spacer(Modifier.height(8.dp))
            Button(onClick = { greeting = "Hello, $name!" }, modifier = Modifier.testTag("greet-button")) {
                Text("Greet")
            }
            Spacer(Modifier.height(8.dp))
            Text(greeting, Modifier.testTag("greeting"))
            Spacer(Modifier.height(8.dp))
            LazyColumn(Modifier.fillMaxWidth().weight(1f).testTag("item-list")) {
                items((0 until 200).toList()) { i ->
                    Text("Item $i", Modifier.fillMaxWidth().padding(12.dp).testTag("item-$i"))
                }
            }
        }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    ComposeViewport(document.body!!) { GreeterPage() }
}
