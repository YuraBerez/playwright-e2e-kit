// Fixture app of the playwright-e2e-kit self-tests. `/` mirrors the React, Vue and Flutter
// fixtures: a name field, a Greet button and a greeting, plus a long lazy list for
// `scrollUntilVisible`. `/lists` has a LazyColumn, a LazyRow and nested lists (#19), and `/fields`
// has a masked, a password, a multiline and a submit field (#20). Every composable the specs touch
// has a `Modifier.testTag`, which Compose web renders as the DOM `id` of its accessibility node.
//
// The text fields get a `contentDescription`: Compose web does not expose the `label` of a
// `TextField` as an accessible name.
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.ComposeViewport
import kotlinx.browser.document
import kotlinx.browser.window

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

/** Lists for `scrollUntilVisible`: a LazyRow, a LazyColumn and a LazyColumn of LazyRows (nested). */
@Composable
fun ListsPage() {
    MaterialTheme {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                "Lists",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() }.testTag("lists-heading"),
            )
            LazyRow(Modifier.fillMaxWidth().height(48.dp).testTag("chip-list")) {
                items((0 until 60).toList()) { i ->
                    Text("Chip $i", Modifier.width(96.dp).padding(12.dp).testTag("chip-$i"))
                }
            }
            Row(Modifier.fillMaxWidth().weight(1f)) {
                LazyColumn(Modifier.weight(1f).fillMaxHeight().testTag("long-list")) {
                    items((0 until 200).toList()) { i ->
                        Text("Row $i", Modifier.fillMaxWidth().padding(12.dp).testTag("row-$i"))
                    }
                }
                LazyColumn(Modifier.weight(1f).fillMaxHeight().testTag("outer-list")) {
                    items((0 until 30).toList()) { s ->
                        Column {
                            Text("Section $s", Modifier.padding(8.dp).testTag("section-$s"))
                            LazyRow(Modifier.fillMaxWidth().height(48.dp).testTag("section-$s-cards")) {
                                items((0 until 20).toList()) { c ->
                                    Text("Card $s.$c", Modifier.width(120.dp).padding(12.dp).testTag("card-$s-$c"))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Shows digits as `555 123 4567`. The field keeps the raw digits; only the display changes. */
class PhoneMask : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val digits = text.text
        val out = buildString {
            digits.forEachIndexed { i, ch ->
                if (i == 3 || i == 6) append(' ')
                append(ch)
            }
        }
        val mapping = object : OffsetMapping {
            override fun originalToTransformed(offset: Int): Int = when {
                offset <= 3 -> offset
                offset <= 6 -> offset + 1
                else -> offset + 2
            }

            override fun transformedToOriginal(offset: Int): Int = when {
                offset <= 3 -> offset
                offset <= 7 -> offset - 1
                else -> offset - 2
            }.coerceIn(0, digits.length)
        }
        return TransformedText(AnnotatedString(out), mapping)
    }
}

/** Text fields for `composeType` / `composeClear` / `composeReadText`. Each field has a status line. */
@Composable
fun FieldsPage() {
    var phone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var search by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf("") }
    MaterialTheme {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                "Fields",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.semantics { heading() }.testTag("fields-heading"),
            )
            TextField(
                value = phone,
                onValueChange = { v -> phone = v.filter { it.isDigit() }.take(10) },
                label = { Text("Phone") },
                singleLine = true,
                visualTransformation = PhoneMask(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.semantics { contentDescription = "Phone" }.testTag("phone-input"),
            )
            Text("Digits: $phone", Modifier.testTag("phone-digits"))
            TextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.semantics { contentDescription = "Password" }.testTag("password-input"),
            )
            Text("Length: ${password.length}", Modifier.testTag("password-length"))
            TextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Notes") },
                minLines = 3,
                modifier = Modifier.semantics { contentDescription = "Notes" }.testTag("notes-input"),
            )
            Text("Lines: ${if (notes.isEmpty()) 0 else notes.lines().size}", Modifier.testTag("notes-lines"))
            TextField(
                value = search,
                onValueChange = { search = it },
                label = { Text("Search") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { submitted = search }),
                modifier = Modifier.semantics { contentDescription = "Search" }.testTag("search-input"),
            )
            Text("Submitted: $submitted", Modifier.testTag("submitted"))
        }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    ComposeViewport(document.body!!) {
        when (window.location.pathname) {
            "/lists" -> ListsPage()
            "/fields" -> FieldsPage()
            else -> GreeterPage()
        }
    }
}
