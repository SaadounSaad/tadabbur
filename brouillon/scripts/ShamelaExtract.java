import org.apache.lucene.index.*;
import org.apache.lucene.store.*;
import org.apache.lucene.document.*;
import java.nio.file.*;
import java.io.*;

public class ShamelaExtract {
    public static void main(String[] args) throws Exception {
        String indexPath = "C:\\shamela4\\database\\store\\page";
        Path p = Paths.get(indexPath);
        Directory dir = FSDirectory.open(p);
        IndexReader reader = DirectoryReader.open(dir);

        System.out.println("Total docs: " + reader.numDocs());

        // Print field names from first doc
        if (reader.numDocs() > 0) {
            Document doc = reader.storedFields().document(0);
            System.out.println("Fields in doc 0:");
            for (IndexableField f : doc.getFields()) {
                System.out.println("  field=" + f.name() + " value=" + f.stringValue());
            }
        }

        // Print first 5 docs
        for (int i = 0; i < Math.min(5, reader.numDocs()); i++) {
            Document doc = reader.storedFields().document(i);
            System.out.println("\n--- Doc " + i + " ---");
            for (IndexableField f : doc.getFields()) {
                String val = f.stringValue();
                if (val != null && val.length() > 200) val = val.substring(0, 200) + "...";
                System.out.println("  " + f.name() + ": " + val);
            }
        }

        reader.close();
        dir.close();
    }
}
